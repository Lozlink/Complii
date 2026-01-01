import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import type { AuthenticatedRequest } from '@/lib/middleware/auth';
import { generateIFTIReport, generateIFTIReportXML, generateIFTIReportCSV } from '@/lib/reports/ifti-generator';

export const runtime = 'nodejs';

/**
 * Generate International Funds Transfer Instructions (IFTI) Report
 * AUSTRAC requirement: Must be submitted within 10 business days for all international transfers
 */
export async function GET(request: NextRequest) {
  try {
    const req = request as AuthenticatedRequest;
    const { tenant } = req;
    const supabase = getServiceClient();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const format = searchParams.get('format') || 'json';

    // Generate the report
    const report = await generateIFTIReport(supabase, tenant.id, startDate, endDate);

    // Return in requested format
    if (format === 'xml') {
      const xml = generateIFTIReportXML(report);
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="IFTI_${report.reportId}.xml"`,
        },
      });
    }

    if (format === 'csv') {
      const csv = generateIFTIReportCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="IFTI_${report.reportId}.csv"`,
        },
      });
    }

    if (format === 'download') {
      return NextResponse.json(report, {
        headers: {
          'Content-Disposition': `attachment; filename="IFTI_${report.reportId}.json"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('IFTI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate IFTI report' },
      { status: 500 }
    );
  }
}
