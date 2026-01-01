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
