import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import {
  generateIndividualTTR,
  generateTTRXml,
  listPendingTTRs,
  markTTRSubmitted,
  generateTTRBatchExport,
} from '@/lib/reports/ttr-generator';

/**
 * GET /v1/reports/ttr - List pending TTRs or generate individual TTR
 *
 * Query params:
 * - transactionId: Generate TTR for specific transaction
 * - format: 'json' | 'xml' (default: json)
 * - status: Filter by status (pending, ready, submitted)
 * - limit: Number of results (default: 50)
 * - export: If 'true', generate batch export (for internal use only)
 * - startDate/endDate: For batch export
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const transactionId = searchParams.get('transactionId');
      const format = searchParams.get('format') || 'json';
      const status = searchParams.get('status') || undefined;
      const limit = parseInt(searchParams.get('limit') || '50');
      const isExport = searchParams.get('export') === 'true';

      const config = getTenantConfig(tenant.region, tenant.settings);

      // Generate individual TTR for specific transaction
      if (transactionId) {
        const reportData = await generateIndividualTTR(
          supabase,
          tenant.tenantId,
          transactionId,
          config
        );

        if (!reportData) {
          return NextResponse.json(
            { error: 'Transaction not found or does not require TTR' },
            { status: 404 }
          );
        }

        // Audit log
        await supabase.from('audit_logs').insert({
          tenant_id: tenant.tenantId,
          action_type: 'ttr_generated',
          entity_type: 'transaction',
          entity_id: transactionId,
          description: `TTR generated: ${reportData.reportReference}`,
          api_key_prefix: tenant.apiKeyPrefix,
        });

        if (format === 'xml') {
          const xml = generateTTRXml(reportData);
          return new NextResponse(xml, {
            headers: {
              'Content-Type': 'application/xml',
              'Content-Disposition': `attachment; filename="${reportData.reportReference}.xml"`,
            },
          });
        }

        return NextResponse.json({
          object: 'ttr_report',
          ...reportData,
        });
      }

      // Batch export for internal reporting (not for AUSTRAC submission)
      if (isExport) {
        const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = searchParams.get('endDate') || new Date().toISOString();

        const exportData = await generateTTRBatchExport(
          supabase,
          tenant.tenantId,
          startDate,
          endDate
        );

        // Save export record
        await supabase.from('compliance_report_history').insert({
          tenant_id: tenant.tenantId,
          report_number: exportData.exportId,
          report_type: 'ttr_batch_export',
          period_start: startDate,
          period_end: endDate,
          transaction_count: exportData.summary.total,
          total_amount: exportData.summary.totalAmount,
          status: 'completed',
          metadata: {
            pending: exportData.summary.pending,
            submitted: exportData.summary.submitted,
            overdue: exportData.summary.overdue,
          },
        });

        return NextResponse.json({
          object: 'ttr_batch_export',
          ...exportData,
        });
      }

      // Default: List pending TTRs
      const result = await listPendingTTRs(supabase, tenant.tenantId, {
        limit,
        status,
      });

      return NextResponse.json({
        object: 'list',
        data: result.transactions,
        hasMore: result.total > limit,
        totalCount: result.total,
        overdueCount: result.overdueCount,
      });
    } catch (error) {
      console.error('TTR error:', error);
      return NextResponse.json(
        { error: 'Failed to process TTR request' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /v1/reports/ttr - Mark TTR as submitted
 *
 * Body:
 * - transactionId: Transaction to mark as submitted
 * - austracReference: Reference number from AUSTRAC (optional)
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const body = await req.json();

      const { transactionId, austracReference } = body;

      if (!transactionId) {
        return NextResponse.json(
          { error: 'transactionId is required' },
          { status: 400 }
        );
      }

      const result = await markTTRSubmitted(
        supabase,
        tenant.tenantId,
        transactionId,
        austracReference
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'TTR marked as submitted',
        transactionId,
        austracReference,
        submittedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('TTR submission error:', error);
      return NextResponse.json(
        { error: 'Failed to mark TTR as submitted' },
        { status: 500 }
      );
    }
  });
}
