import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import {
  generateTTRReportData,
  generateTTRReportCSV,
  generateTTRReportJSON,
} from '@/lib/reports/ttr-generator';

// GET /v1/reports/ttr - Generate TTR report
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const startDate = searchParams.get('startDate') || undefined;
      const endDate = searchParams.get('endDate') || undefined;
      const format = searchParams.get('format') || 'json'; // json, csv

      // Generate report data
      const reportData = await generateTTRReportData(
        supabase,
        tenant.tenantId,
        startDate,
        endDate
      );

      // Save to ttr_reports table for history
      const { error: insertError } = await supabase
        .from('ttr_reports')
        .insert({
          tenant_id: tenant.tenantId,
          report_number: reportData.reportId,
          report_type: 'ttr',
          period_start: reportData.reportingPeriod.start,
          period_end: reportData.reportingPeriod.end,
          transaction_count: reportData.transactionCount,
          total_amount: reportData.totalAmount,
          status: 'completed',
          generated_at: new Date().toISOString(),
          metadata: {
            format,
            //averageValue: reportData.summary.averageValue,
            //breakdown: reportData.summary.breakdown,
          },
        });

      if (insertError) {
        console.error('Failed to save report history:', insertError);
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'ttr_report_generated',
        entity_type: 'report',
        description: `Generated TTR report for period ${reportData.reportingPeriod.start} to ${reportData.reportingPeriod.end}`,
        metadata: { reportId: reportData.reportId, format },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      if (format === 'csv') {
        const csv = generateTTRReportCSV(reportData);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${reportData.reportId}.csv"`,
          },
        });
      }

      // Default to JSON
      if (format === 'download') {
        const json = generateTTRReportJSON(reportData);
        return new NextResponse(json, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${reportData.reportId}.json"`,
          },
        });
      }

      return NextResponse.json(reportData);
    } catch (error) {
      console.error('TTR report generation error:', error);
      return NextResponse.json(
        { error: 'Failed to generate TTR report' },
        { status: 500 }
      );
    }
  });
}
