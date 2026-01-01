import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import { generateTTRReference } from '@/lib/compliance/thresholds';
import { createValidationError, createInternalError } from '@/lib/utils/errors';

interface TransactionBatchInput {
  customerId: string;
  externalId?: string;
  amount: number;
  currency?: string;
  direction: 'incoming' | 'outgoing';
  type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface BatchResult {
  externalId?: string;
  customerId: string;
  id?: string;
  status: 'created' | 'failed';
  requiresTtr?: boolean;
  ttrReference?: string;
  error?: string;
}

const MAX_BATCH_SIZE = 100;

function extractCustomerId(idParam: string): string {
  if (idParam.startsWith('cus_')) {
    return idParam.slice(4);
  }
  return idParam;
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const transactions: TransactionBatchInput[] = body.transactions;

      if (!transactions || !Array.isArray(transactions)) {
        return createValidationError('transactions', 'transactions must be an array');
      }

      if (transactions.length === 0) {
        return createValidationError('transactions', 'transactions array cannot be empty');
      }

      if (transactions.length > MAX_BATCH_SIZE) {
        return createValidationError(
          'transactions',
          `Maximum batch size is ${MAX_BATCH_SIZE} transactions`
        );
      }

      // Validate each transaction
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        if (!tx.customerId) {
          return createValidationError(`transactions[${i}].customerId`, 'customerId is required');
        }
        if (tx.amount === undefined || tx.amount <= 0) {
          return createValidationError(`transactions[${i}].amount`, 'amount must be positive');
        }
        if (!tx.direction || !['incoming', 'outgoing'].includes(tx.direction)) {
          return createValidationError(`transactions[${i}].direction`, 'direction must be incoming or outgoing');
        }
      }

      const { tenant } = req;
      const supabase = getServiceClient();
      const config = getTenantConfig(tenant.region, tenant.settings);

      const results: BatchResult[] = [];
      let succeeded = 0;
      let failed = 0;

      // Build customer ID lookup map
      const customerIds = [...new Set(transactions.map((tx) => extractCustomerId(tx.customerId)))];
      const { data: customers } = await supabase
        .from('customers')
        .select('id, external_id')
        .eq('tenant_id', tenant.tenantId)
        .or(customerIds.map((id) => `id.eq.${id},external_id.eq.${id}`).join(','));

      const customerMap = new Map<string, string>();
      for (const customer of customers || []) {
        customerMap.set(customer.id, customer.id);
        if (customer.external_id) {
          customerMap.set(customer.external_id, customer.id);
        }
      }

      // Process each transaction
      for (const tx of transactions) {
        try {
          const customerId = extractCustomerId(tx.customerId);
          const resolvedCustomerId = customerMap.get(customerId) || customerMap.get(tx.customerId);

          if (!resolvedCustomerId) {
            results.push({
              externalId: tx.externalId,
              customerId: tx.customerId,
              status: 'failed',
              error: 'Customer not found',
            });
            failed++;
            continue;
          }

          // Check TTR threshold
          const requiresTtr = tx.amount >= config.thresholds.ttrRequired;

          // Create transaction
          const { data: created, error } = await supabase
            .from('transactions')
            .insert({
              tenant_id: tenant.tenantId,
              customer_id: resolvedCustomerId,
              external_id: tx.externalId,
              amount: tx.amount,
              currency: tx.currency || config.currency,
              amount_local: tx.amount,
              direction: tx.direction,
              transaction_type: tx.type,
              description: tx.description,
              requires_ttr: requiresTtr,
              metadata: tx.metadata || {},
            })
            .select('id')
            .single();

          if (error) {
            results.push({
              externalId: tx.externalId,
              customerId: tx.customerId,
              status: 'failed',
              error: error.message,
            });
            failed++;
          } else {
            let ttrReference: string | undefined;
            if (requiresTtr) {
              ttrReference = generateTTRReference(created.id);
              await supabase
                .from('transactions')
                .update({
                  ttr_reference: ttrReference,
                  ttr_generated_at: new Date().toISOString(),
                })
                .eq('id', created.id);
            }

            results.push({
              externalId: tx.externalId,
              customerId: tx.customerId,
              id: `txn_${created.id.slice(0, 8)}`,
              status: 'created',
              requiresTtr,
              ttrReference,
            });
            succeeded++;
          }
        } catch (err) {
          results.push({
            externalId: tx.externalId,
            customerId: tx.customerId,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          failed++;
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'transactions_batch_created',
        entity_type: 'transaction',
        description: `Batch created ${succeeded} transactions (${failed} failed)`,
        metadata: { succeeded, failed, total: transactions.length },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'batch_result',
        succeeded,
        failed,
        total: transactions.length,
        results,
      });
    } catch (error) {
      console.error('Batch transaction create error:', error);
      return createInternalError('Failed to process batch');
    }
  });
}
