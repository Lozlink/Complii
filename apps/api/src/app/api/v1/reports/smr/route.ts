import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { generateSMRReport, generateSMRReportXML } from '@/lib/reports/smr-generator';
import {getTenantConfig, RegionalConfig} from "@/lib/config/regions";

export const runtime = 'nodejs';

/**
 * Generate Suspicious Matter Report (SMR)
 * AUSTRAC requirement: Must be submitted within 24 hours of forming a suspicion
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const config = getTenantConfig(tenant.region, tenant.settings);

      const body = await req.json();
      const {
        activityType,
        description,
        suspicionFormedDate,
        customerId,
        transactionIds,
        suspicionGrounds,
        actionTaken,
        reportingOfficer,
        additionalInformation,
        format = 'json',
      } = body;

      // Validation
      if (!activityType || !['money_laundering', 'terrorism_financing', 'other'].includes(activityType)) {
        return NextResponse.json(
          { error: 'Valid activityType is required (money_laundering, terrorism_financing, or other)' },
          { status: 400 }
        );
      }

      if (!description || !suspicionFormedDate || !transactionIds || !Array.isArray(transactionIds)) {
        return NextResponse.json(
          { error: 'description, suspicionFormedDate, and transactionIds are required' },
          { status: 400 }
        );
      }

      if (!suspicionGrounds || !actionTaken || !reportingOfficer) {
        return NextResponse.json(
          { error: 'suspicionGrounds, actionTaken, and reportingOfficer are required' },
          { status: 400 }
        );
      }

      // Generate the report
      const report = await generateSMRReport(supabase, tenant.tenantId,config, {
        activityType,
        description,
        suspicionFormedDate,
        customerId,
        transactionIds,
        suspicionGrounds,
        actionTaken,
        reportingOfficer,
        additionalInformation,
      });

      // Return in requested format
      if (format === 'xml') {
        const xml = generateSMRReportXML(report);
        return new NextResponse(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Content-Disposition': `attachment; filename="SMR_${report.reportId}.xml"`,
          },
        });
      }

      if (format === 'download') {
        return NextResponse.json(report, {
          headers: {
            'Content-Disposition': `attachment; filename="SMR_${report.reportId}.json"`,
          },
        });
      }

      return NextResponse.json(report);
    } catch (error) {
      console.error('SMR generation error:', error);
      return NextResponse.json(
        { error: 'Failed to generate SMR report' },
        { status: 500 }
      );
    }
  });
}

/**
 * List all SMR reports for the tenant
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();

      const { searchParams } = new URL(req.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
      const offset = parseInt(searchParams.get('offset') || '0');
      const status = searchParams.get('status');
      const activityType = searchParams.get('activityType');

      let query = supabase
        .from('smr_reports')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { data: reports, error, count } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        object: 'list',
        data: reports || [],
        hasMore: offset + limit < (count || 0),
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('SMR list error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve SMR reports' },
        { status: 500 }
      );
    }
  });
}
