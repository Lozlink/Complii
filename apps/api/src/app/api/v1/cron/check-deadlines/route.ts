import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import { getBusinessDaysRemaining } from '@/lib/utils/deadline-utils';
import { sendTTRDeadlineAlert, sendSMRDeadlineAlert } from '@/lib/utils/compliance-alerts';
import { dispatchDeadlineAlert } from '@/lib/webhooks/dispatcher';

/**
 * Cron job to check compliance report deadlines
 * Runs daily at 8am to alert on approaching/overdue TTR and SMR deadlines
 *
 * Security: Requires CRON_SECRET env variable matching request header
 *
 * Schedule: Daily at 8:00 AM AEST (Vercel Cron or AWS EventBridge)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const results = {
      ttr_checked: 0,
      ttr_alerts_sent: 0,
      smr_checked: 0,
      smr_alerts_sent: 0,
      errors: [] as string[],
    };

    // Get all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        message: 'No active tenants found',
        results,
      });
    }

    // Process each tenant
    for (const tenant of tenants) {
      try {
        // Check TTR deadlines
        const ttrResults = await checkTTRDeadlines(supabase, tenant.id);
        results.ttr_checked += ttrResults.checked;
        results.ttr_alerts_sent += ttrResults.alerts_sent;

        // Check SMR deadlines
        const smrResults = await checkSMRDeadlines(supabase, tenant.id);
        results.smr_checked += smrResults.checked;
        results.smr_alerts_sent += smrResults.alerts_sent;
      } catch (error) {
        const errorMsg = `Tenant ${tenant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[Deadline Checker] ${errorMsg}`);
      }
    }

    // Log execution to audit trail
    await supabase.from('audit_logs').insert({
      tenant_id: null, // System-level operation
      action_type: 'deadline_check_completed',
      entity_type: 'system',
      entity_id: null,
      description: `Deadline check completed: ${results.ttr_checked} TTRs, ${results.smr_checked} SMRs checked`,
      metadata: results,
    });

    return NextResponse.json({
      message: 'Deadline check completed successfully',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Deadline Checker] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function checkTTRDeadlines(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string
): Promise<{ checked: number; alerts_sent: number }> {
  // Get pending TTRs with deadlines
  const { data: ttrs, error } = await supabase
    .from('transactions')
    .select('id, ttr_reference, ttr_submission_deadline, ttr_submission_status, created_at, amount, currency')
    .eq('tenant_id', tenantId)
    .eq('requires_ttr', true)
    .in('ttr_submission_status', ['pending', 'ready'])
    .not('ttr_submission_deadline', 'is', null)
    .order('ttr_submission_deadline', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch TTRs: ${error.message}`);
  }

  if (!ttrs || ttrs.length === 0) {
    return { checked: 0, alerts_sent: 0 };
  }

  // Group TTRs by urgency
  const overdue: typeof ttrs = [];
  const dueTomorrow: typeof ttrs = [];
  const dueIn2Days: typeof ttrs = [];
  const dueIn5Days: typeof ttrs = [];

  for (const ttr of ttrs) {
    if (!ttr.ttr_submission_deadline) continue;

    const daysRemaining = getBusinessDaysRemaining(ttr.ttr_submission_deadline);

    if (daysRemaining === 0) {
      overdue.push(ttr);
    } else if (daysRemaining === 1) {
      dueTomorrow.push(ttr);
    } else if (daysRemaining === 2) {
      dueIn2Days.push(ttr);
    } else if (daysRemaining === 5) {
      dueIn5Days.push(ttr);
    }
  }

  let alertsSent = 0;

  // Check if we already sent an alert today to avoid duplicates
  const today = new Date().toISOString().split('T')[0];
  const { data: todaysAlerts } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .eq('action_type', 'compliance_alert_sent')
    .gte('created_at', `${today}T00:00:00Z`)
    .like('metadata->>alert_type', 'ttr_deadline');

  const alertedToday = todaysAlerts && todaysAlerts.length > 0;

  // Send alerts if we haven't already today and there are TTRs requiring attention
  if (!alertedToday) {
    if (overdue.length > 0) {
      await sendTTRDeadlineAlert(tenantId, 0, overdue.length, '/dashboard/reports/ttr');
      await dispatchDeadlineAlert(supabase, tenantId, 'ttr', true, {
        count: overdue.length,
        days_remaining: 0,
        ttrs: overdue.map((t) => ({ id: t.id, reference: t.ttr_reference })),
      });
      alertsSent++;
    } else if (dueTomorrow.length > 0) {
      await sendTTRDeadlineAlert(tenantId, 1, dueTomorrow.length, '/dashboard/reports/ttr');
      await dispatchDeadlineAlert(supabase, tenantId, 'ttr', false, {
        count: dueTomorrow.length,
        days_remaining: 1,
      });
      alertsSent++;
    } else if (dueIn2Days.length > 0) {
      await sendTTRDeadlineAlert(tenantId, 2, dueIn2Days.length, '/dashboard/reports/ttr');
      await dispatchDeadlineAlert(supabase, tenantId, 'ttr', false, {
        count: dueIn2Days.length,
        days_remaining: 2,
      });
      alertsSent++;
    } else if (dueIn5Days.length > 0) {
      await sendTTRDeadlineAlert(tenantId, 5, dueIn5Days.length, '/dashboard/reports/ttr');
      await dispatchDeadlineAlert(supabase, tenantId, 'ttr', false, {
        count: dueIn5Days.length,
        days_remaining: 5,
      });
      alertsSent++;
    }
  }

  return {
    checked: ttrs.length,
    alerts_sent: alertsSent,
  };
}

async function checkSMRDeadlines(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string
): Promise<{ checked: number; alerts_sent: number }> {
  // Get pending SMRs with deadlines
  const { data: smrs, error } = await supabase
    .from('suspicious_matter_reports')
    .select('id, report_number, submission_deadline, status, suspicion_formed_date')
    .eq('tenant_id', tenantId)
    .in('status', ['draft', 'pending_review', 'approved'])
    .not('submission_deadline', 'is', null)
    .order('submission_deadline', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch SMRs: ${error.message}`);
  }

  if (!smrs || smrs.length === 0) {
    return { checked: 0, alerts_sent: 0 };
  }

  // Group SMRs by urgency
  const overdue: typeof smrs = [];
  const dueTomorrow: typeof smrs = [];
  const dueIn2Days: typeof smrs = [];

  for (const smr of smrs) {
    if (!smr.submission_deadline) continue;

    const daysRemaining = getBusinessDaysRemaining(smr.submission_deadline);

    if (daysRemaining === 0) {
      overdue.push(smr);
    } else if (daysRemaining === 1) {
      dueTomorrow.push(smr);
    } else if (daysRemaining === 2) {
      dueIn2Days.push(smr);
    }
  }

  let alertsSent = 0;

  // Check if we already sent an alert today
  const today = new Date().toISOString().split('T')[0];
  const { data: todaysAlerts } = await supabase
    .from('audit_logs')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .eq('action_type', 'compliance_alert_sent')
    .gte('created_at', `${today}T00:00:00Z`)
    .like('metadata->>alert_type', 'smr_deadline');

  const alertedToday = todaysAlerts && todaysAlerts.length > 0;

  if (!alertedToday) {
    if (overdue.length > 0) {
      await sendSMRDeadlineAlert(tenantId, 0, overdue.length, '/dashboard/reports/smr');
      await dispatchDeadlineAlert(supabase, tenantId, 'smr', true, {
        count: overdue.length,
        days_remaining: 0,
      });
      alertsSent++;
    } else if (dueTomorrow.length > 0) {
      await sendSMRDeadlineAlert(tenantId, 1, dueTomorrow.length, '/dashboard/reports/smr');
      await dispatchDeadlineAlert(supabase, tenantId, 'smr', false, {
        count: dueTomorrow.length,
        days_remaining: 1,
      });
      alertsSent++;
    } else if (dueIn2Days.length > 0) {
      await sendSMRDeadlineAlert(tenantId, 2, dueIn2Days.length, '/dashboard/reports/smr');
      await dispatchDeadlineAlert(supabase, tenantId, 'smr', false, {
        count: dueIn2Days.length,
        days_remaining: 2,
      });
      alertsSent++;
    }
  }

  return {
    checked: smrs.length,
    alerts_sent: alertsSent,
  };
}
