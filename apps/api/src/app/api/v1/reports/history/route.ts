import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /v1/reports/history - Get report generation history
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const reportType = searchParams.get('type'); // ttr, smr, ifti

      let query = supabase
        .from('compliance_report_history')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('generated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Failed to fetch reports history:', error);
        return NextResponse.json(
          { error: 'Failed to fetch report history' },
          { status: 500 }
        );
      }

      // Transform data to match expected format
      const reports = (data || []).map((r) => ({
          id: `rpt_${r.id}`,
          object: 'report',
          reportNumber: r.report_number,
          reportType: r.report_type,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          transactionCount: r.transaction_count,
          totalAmount: parseFloat(r.total_amount),
        status: r.status,
        generatedAt: r.generated_at,
        fileUrl: r.file_url,
        metadata: r.metadata,
      }));

      return NextResponse.json({
        object: 'list',
        data: reports,
        hasMore: (count || 0) > offset + limit,
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('Reports history error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch report history' },
        { status: 500 }
      );
    }
  });
}
