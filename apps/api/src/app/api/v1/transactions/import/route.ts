import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import { generateTTRReference } from '@/lib/compliance/thresholds';
import { parseTransactionFile, ParsedRow } from '@/lib/import/csv-parser';
import { findOrCreateCustomer, CustomerMatchResult } from '@/lib/import/customer-matcher';
import { checkDuplicate, DuplicateCheckResult } from '@/lib/import/deduplication';
import { runBatchCompliance } from '@/lib/compliance/batch-processor';

interface ImportRowResult {
  rowNumber: number;
  status: 'success' | 'duplicate' | 'failed';
  transactionId?: string;
  customerId?: string;
  customerMatchMethod?: string;
  duplicateId?: string;
  duplicateMatchMethod?: string;
  error?: string;
  warnings?: string[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 1000; // Process up to 1000 rows per import

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const config = getTenantConfig(tenant.region, tenant.settings);

      // Parse multipart form data
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const skipDuplicates = formData.get('skipDuplicates') === 'true';
      const dryRun = formData.get('dryRun') === 'true';

      if (!file) {
        return NextResponse.json(
          { error: 'file is required' },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xls|xlsx)$/i)) {
        return NextResponse.json(
          { error: 'Invalid file type. Supported formats: CSV, XLS, XLSX' },
          { status: 400 }
        );
      }

      // Read file buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Parse file
      const parseResult = parseTransactionFile(buffer, file.name);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Failed to parse file',
            details: parseResult.errors,
            invalidRows: parseResult.invalidRows.map((row) => ({
              rowNumber: row.rowNumber,
              errors: row.errors,
              warnings: row.warnings,
            })),
          },
          { status: 400 }
        );
      }

      // Check row limit
      if (parseResult.validRows.length > MAX_ROWS) {
        return NextResponse.json(
          {
            error: `File contains too many rows (${parseResult.validRows.length}). Maximum is ${MAX_ROWS} rows per import.`,
          },
          { status: 400 }
        );
      }

      // Process rows
      const results: ImportRowResult[] = [];
      const createdTransactionIds: string[] = [];

      for (const parsedRow of parseResult.validRows) {
        try {
          // Step 1: Find or create customer
          const customerMatch = await findOrCreateCustomer(
            supabase,
            tenant.tenantId,
            parsedRow.data
          );

          if (!customerMatch.matched || !customerMatch.customerId) {
            results.push({
              rowNumber: parsedRow.rowNumber,
              status: 'failed',
              error: customerMatch.error || 'Failed to match or create customer',
              warnings: parsedRow.warnings,
            });
            continue;
          }

          // Step 2: Check for duplicates
          const duplicateCheck = await checkDuplicate(
            supabase,
            tenant.tenantId,
            customerMatch.customerId,
            parsedRow.data
          );

          if (duplicateCheck.isDuplicate) {
            results.push({
              rowNumber: parsedRow.rowNumber,
              status: 'duplicate',
              customerId: customerMatch.customerId,
              customerMatchMethod: customerMatch.matchMethod,
              duplicateId: duplicateCheck.duplicateId,
              duplicateMatchMethod: duplicateCheck.matchMethod,
              warnings: parsedRow.warnings,
            });

            if (skipDuplicates) {
              continue;
            }
          }

          // Step 3: Create transaction (unless dry run)
          if (!dryRun && !duplicateCheck.isDuplicate) {
            const requiresTtr = parsedRow.data.amount >= config.thresholds.ttrRequired;

            const { data: transaction, error: txError } = await supabase
              .from('transactions')
              .insert({
                tenant_id: tenant.tenantId,
                customer_id: customerMatch.customerId,
                external_id: parsedRow.data.externalTransactionId,
                amount: parsedRow.data.amount,
                currency: parsedRow.data.currency,
                amount_local: parsedRow.data.amount,
                direction: parsedRow.data.direction,
                transaction_type: parsedRow.data.transactionType,
                description: parsedRow.data.description,
                reference: parsedRow.data.reference,
                requires_ttr: requiresTtr,
                created_at: parsedRow.data.transactionDate,
                metadata: {
                  imported_via: 'csv_import',
                  import_date: new Date().toISOString(),
                  import_file: file.name,
                  import_row: parsedRow.rowNumber,
                },
              })
              .select('id')
              .single();

            if (txError) {
              results.push({
                rowNumber: parsedRow.rowNumber,
                status: 'failed',
                customerId: customerMatch.customerId,
                customerMatchMethod: customerMatch.matchMethod,
                error: `Failed to create transaction: ${txError.message}`,
                warnings: parsedRow.warnings,
              });
              continue;
            }

            // Generate TTR reference if needed
            if (requiresTtr) {
              const ttrReference = generateTTRReference(transaction.id);
              await supabase
                .from('transactions')
                .update({
                  ttr_reference: ttrReference,
                  ttr_generated_at: new Date().toISOString(),
                })
                .eq('id', transaction.id);
            }

            createdTransactionIds.push(transaction.id);

            results.push({
              rowNumber: parsedRow.rowNumber,
              status: 'success',
              transactionId: transaction.id,
              customerId: customerMatch.customerId,
              customerMatchMethod: customerMatch.matchMethod,
              warnings: parsedRow.warnings,
            });
          } else {
            // Dry run - just report what would happen
            results.push({
              rowNumber: parsedRow.rowNumber,
              status: duplicateCheck.isDuplicate ? 'duplicate' : 'success',
              customerId: customerMatch.customerId,
              customerMatchMethod: customerMatch.matchMethod,
              duplicateId: duplicateCheck.duplicateId,
              duplicateMatchMethod: duplicateCheck.matchMethod,
              warnings: parsedRow.warnings,
            });
          }
        } catch (rowError) {
          results.push({
            rowNumber: parsedRow.rowNumber,
            status: 'failed',
            error: rowError instanceof Error ? rowError.message : 'Unknown error',
            warnings: parsedRow.warnings,
          });
        }
      }

      // Count results
      const summary = {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows.length,
        invalidRows: parseResult.invalidRows.length,
        succeeded: results.filter((r) => r.status === 'success').length,
        duplicates: results.filter((r) => r.status === 'duplicate').length,
        failed: results.filter((r) => r.status === 'failed').length,
      };

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'transactions.imported',
        entity_type: 'transaction',
        description: `Imported ${summary.succeeded} transactions from ${file.name} (${summary.duplicates} duplicates, ${summary.failed} failed)`,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          ...summary,
          dryRun,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      // Run compliance checks asynchronously (if not dry run)
      if (!dryRun && createdTransactionIds.length > 0) {
        // Fire and forget
        runBatchCompliance(supabase, tenant.tenantId, createdTransactionIds)
          .then((complianceResult) => {
            console.log('Import compliance processing completed:', complianceResult);
          })
          .catch((error) => {
            console.error('Import compliance processing failed:', error);
          });
      }

      return NextResponse.json({
        object: 'import_result',
        fileName: file.name,
        fileSize: file.size,
        summary,
        results,
        invalidRows: parseResult.invalidRows.map((row) => ({
          rowNumber: row.rowNumber,
          errors: row.errors,
          warnings: row.warnings,
          data: row.data,
        })),
        complianceProcessing: !dryRun && createdTransactionIds.length > 0 ? 'running' : 'skipped',
        dryRun,
      });
    } catch (error) {
      console.error('Transaction import error:', error);
      return NextResponse.json(
        {
          error: 'Failed to process import',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
