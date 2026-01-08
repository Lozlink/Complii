import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { generateSMRReport, generateSMRReportXML } from '@/lib/reports/smr-generator';
import {getTenantConfig, RegionalConfig} from "@/lib/config/regions";
import { dispatchAlertCreated } from '@/lib/webhooks/dispatcher';

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

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
        skipEddTrigger = false,
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
        customerId: customerId ? extractCustomerId(customerId) : undefined,
        transactionIds,
        suspicionGrounds,
        actionTaken,
        reportingOfficer,
        additionalInformation,
        skipEddTrigger,
      });

      // Create alert for SMR creation
      try {
        // Get the alert rule
        const { data: rule } = await supabase
          .from('alert_rules')
          .select('*')
          .eq('tenant_id', tenant.tenantId)
          .eq('rule_code', 'SMR_CREATED')
          .eq('is_enabled', true)
          .maybeSingle();

        if (rule && report.customerId) {
          // Generate alert number
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const { count } = await supabase
            .from('alerts')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.tenantId)
            .gte('created_at', new Date().toISOString().slice(0, 10));

          const alertNumber = `ALT-${today}-${String((count || 0) + 1).padStart(4, '0')}`;

          // Create alert
          const { data: alert } = await supabase
            .from('alerts')
            .insert({
              tenant_id: tenant.tenantId,
              alert_rule_id: rule.id,
              alert_number: alertNumber,
              title: `SMR ${report.reportId} created - requires submission`,
              description: `Suspicious Matter Report ${report.reportId} has been created and must be submitted to AUSTRAC by ${new Date(report.submissionDeadline).toLocaleDateString()}. Activity type: ${activityType.replace(/_/g, ' ')}.`,
              severity: rule.severity || 'critical',
              status: 'open',
              entity_type: 'customer',
              entity_id: report.customerId,
              customer_id: report.customerId,
              metadata: {
                smrReportId: report.reportId,
                activityType,
                suspicionFormedDate,
                submissionDeadline: report.submissionDeadline,
                transactionCount: transactionIds?.length || 0,
              },
            })
            .select()
            .single();

          // Dispatch webhook
          if (alert) {
            await dispatchAlertCreated(supabase, tenant.tenantId, alert).catch((err) => {
              console.error('Failed to dispatch SMR alert webhook:', err);
            });
          }
        }
      } catch (alertError) {
        console.error('Failed to create alert for SMR:', alertError);
        // Don't fail the SMR creation if alert fails
      }

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
        .select(`
          *,
          customers (
            first_name,
            last_name,
            email
          )
        `, { count: 'exact' })
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

      // Transform database fields to camelCase for API response
      const transformedReports = (reports || []).map((report) => {
        const customer = report.customers as { first_name?: string; last_name?: string; email?: string } | null;
        const customerName = customer 
          ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() 
          : undefined;

        return {
          id: report.id,
          reportNumber: report.report_number,
          activityType: report.report_type,
          status: report.status,
          suspicionFormedDate: report.suspicion_formed_date,
          createdAt: report.created_at,
          customerId: report.customer_id,
          customerName,
          customerEmail: customer?.email,
          suspicionGrounds: report.suspicion_grounds,
          submissionDeadline: report.submission_deadline,
          actionTaken: report.action_taken,
          reportingOfficer: report.reporting_officer,
          transactionIds: report.transaction_ids,
          totalAmount: report.total_amount,
          currency: report.currency,
          metadata: report.metadata,
        };
      });

      return NextResponse.json({
        object: 'list',
        data: transformedReports,
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
