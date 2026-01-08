import { SupabaseClient } from '@supabase/supabase-js';
import { dispatchDeadlineAlert, dispatchAlertCreated } from '../webhooks/dispatcher';
import { getBusinessDaysRemaining } from './deadline-utils';
import { getTenantConfig } from '../config/regions';

interface DeadlineCheckResult {
  ttrAlertsSent: number;
  smrAlertsSent: number;
  errors: string[];
}

type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Get severity based on days remaining
 */
function getSeverity(daysRemaining: number, isSmr: boolean): AlertSeverity {
  if (daysRemaining <= 0) return 'critical';
  if (isSmr) {
    // SMR has 3-day deadline, so more urgent thresholds
    if (daysRemaining === 1) return 'critical';
    return 'high';
  }
  // TTR has 10-day deadline
  if (daysRemaining <= 1) return 'critical';
  if (daysRemaining <= 2) return 'high';
  if (daysRemaining <= 5) return 'medium';
  return 'low';
}

/**
 * Create an alert in the alerts table and dispatch webhook
 */
async function createDeadlineAlert(
  supabase: SupabaseClient,
  tenantId: string,
  params: {
    type: 'ttr' | 'smr';
    entityId: string;
    entityType: string;
    customerId?: string;
    customerName: string;
    daysRemaining: number;
    deadline: string;
    amount?: number;
    currency?: string;
    reference?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const {
    type,
    entityId,
    entityType,
    customerId,
    customerName,
    daysRemaining,
    deadline,
    amount,
    currency,
    reference,
  } = params;

  const isOverdue = daysRemaining <= 0;
  const severity = getSeverity(daysRemaining, type === 'smr');

  const title = isOverdue
    ? `${type.toUpperCase()} Deadline OVERDUE`
    : `${type.toUpperCase()} Deadline Approaching (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''})`;

  const description = isOverdue
    ? `${type.toUpperCase()} for ${customerName} is OVERDUE. Deadline was ${deadline}. Immediate action required.`
    : `${type.toUpperCase()} for ${customerName} is due in ${daysRemaining} business day${daysRemaining !== 1 ? 's' : ''} (${deadline}).`;

  // Generate alert number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', new Date().toISOString().slice(0, 10));

  const alertNumber = `ALT-${today}-${String((count || 0) + 1).padStart(4, '0')}`;

  // Insert alert
  const { data: alert, error } = await supabase
    .from('alerts')
    .insert({
      tenant_id: tenantId,
      alert_number: alertNumber,
      title,
      description,
      severity,
      entity_type: entityType,
      entity_id: entityId,
      customer_id: customerId,
      trigger_data: {
        type,
        days_remaining: daysRemaining,
        deadline,
        is_overdue: isOverdue,
        amount,
        currency,
        reference,
      },
      metadata: {
        alert_source: 'deadline_checker',
        customer_name: customerName,
      },
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create deadline alert:', error);
    return { success: false, error: error.message };
  }

  // Log that we sent an alert
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: `${type}_deadline_alert`,
    entity_type: entityType,
    entity_id: entityId,
    description: `${type.toUpperCase()} deadline alert: ${daysRemaining} days remaining`,
    metadata: {
      days_remaining: daysRemaining,
      deadline,
      alert_id: alert.id,
      alert_number: alertNumber,
      severity,
    },
  });

  // Dispatch webhooks
  const webhookData = {
    alertId: alert.id,
    alertNumber,
    type,
    entityId,
    entityType,
    customerId,
    customerName,
    daysRemaining,
    deadline,
    severity,
    amount,
    currency,
    reference,
  };

  await dispatchDeadlineAlert(supabase, tenantId, type, isOverdue, webhookData);
  await dispatchAlertCreated(supabase, tenantId, {
    id: alert.id,
    alertNumber,
    title,
    description,
    severity,
    entityType,
    entityId,
    customerId,
  });

  return { success: true };
}

/**
 * Check for TTRs with approaching deadlines and create alerts.
 * Alert thresholds:
 * - 5 days remaining: first warning
 * - 2 days remaining: urgent warning
 * - 1 day remaining: critical warning
 * - 0 or negative: overdue
 */
async function checkTTRDeadlines(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ alertsSent: number; errors: string[] }> {
  const errors: string[] = [];
  let alertsSent = 0;

  try {
    const config = getTenantConfig(tenantId);

    // Get TTRs that require submission and haven't been submitted
    const { data: pendingTTRs, error } = await supabase
      .from('transactions')
      .select(`
        id,
        ttr_reference,
        customer_id,
        amount,
        currency,
        created_at,
        ttr_submission_deadline,
        description,
        customers (
          first_name,
          last_name,
          email
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('requires_ttr', true)
      .is('ttr_submitted_at', null)
      .not('ttr_submission_deadline', 'is', null);

    if (error) {
      console.error('Error fetching pending TTRs:', error);
      errors.push(`TTR fetch error: ${error.message}`);
      return { alertsSent, errors };
    }

    if (!pendingTTRs || pendingTTRs.length === 0) {
      return { alertsSent, errors };
    }

    console.log(`Checking ${pendingTTRs.length} pending TTRs for deadline alerts`);

    for (const ttr of pendingTTRs) {
      const deadline = new Date(ttr.ttr_submission_deadline);
      const daysRemaining = getBusinessDaysRemaining(deadline, config);

      // Send alerts at specific thresholds: 5, 2, 1, 0 days or overdue
      const shouldAlert = daysRemaining <= 5;

      if (!shouldAlert) continue;

      // Check if we already sent an alert today for this TTR
      const today = new Date().toISOString().split('T')[0];
      const { data: existingAlert } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('entity_id', ttr.id)
        .eq('action_type', 'ttr_deadline_alert')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (existingAlert && existingAlert.length > 0) {
        continue;
      }

      // Get customer name
      const customer = ttr.customers as { first_name?: string; last_name?: string } | null;
      const customerName = customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';

      const result = await createDeadlineAlert(supabase, tenantId, {
        type: 'ttr',
        entityId: ttr.id,
        entityType: 'transaction',
        customerId: ttr.customer_id,
        customerName,
        daysRemaining,
        deadline: deadline.toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        amount: parseFloat(ttr.amount),
        currency: ttr.currency,
        reference: ttr.ttr_reference,
      });

      if (result.success) {
        alertsSent++;
      } else {
        errors.push(`Failed to create TTR alert for ${ttr.id}: ${result.error}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error checking TTR deadlines:', err);
    errors.push(`TTR check error: ${message}`);
  }

  return { alertsSent, errors };
}

/**
 * Check for SMRs with approaching deadlines and create alerts.
 * SMR deadline is 3 business days, so we alert at:
 * - 2 days remaining: warning
 * - 1 day remaining: urgent
 * - 0 days (due today): critical
 * - negative: overdue
 */
async function checkSMRDeadlines(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ alertsSent: number; errors: string[] }> {
  const errors: string[] = [];
  let alertsSent = 0;

  try {
    const config = getTenantConfig(tenantId);

    // Get SMRs that are pending/under review and have deadlines
    const { data: pendingSMRs, error } = await supabase
      .from('smr_reports')
      .select(`
        id,
        customer_id,
        suspicion_grounds,
        submission_deadline,
        created_at,
        customers (
          first_name,
          last_name
        )
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'under_review'])
      .not('submission_deadline', 'is', null);

    if (error) {
      console.error('Error fetching pending SMRs:', error);
      errors.push(`SMR fetch error: ${error.message}`);
      return { alertsSent, errors };
    }

    if (!pendingSMRs || pendingSMRs.length === 0) {
      return { alertsSent, errors };
    }

    console.log(`Checking ${pendingSMRs.length} pending SMRs for deadline alerts`);

    for (const smr of pendingSMRs) {
      const deadline = new Date(smr.submission_deadline);
      const daysRemaining = getBusinessDaysRemaining(deadline, config);

      // SMRs have a 3-day deadline, so alert at 2, 1, 0 days or overdue
      const shouldAlert = daysRemaining <= 2;

      if (!shouldAlert) continue;

      // Check if we already sent an alert today for this SMR
      const today = new Date().toISOString().split('T')[0];
      const { data: existingAlert } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('entity_id', smr.id)
        .eq('action_type', 'smr_deadline_alert')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (existingAlert && existingAlert.length > 0) {
        continue;
      }

      // Get customer name
      const customer = smr.customers as { first_name?: string; last_name?: string } | null;
      const customerName = customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';

      const result = await createDeadlineAlert(supabase, tenantId, {
        type: 'smr',
        entityId: smr.id,
        entityType: 'suspicious_activity_report',
        customerId: smr.customer_id,
        customerName,
        daysRemaining,
        deadline: deadline.toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        reference: smr.suspicion_grounds,
      });

      if (result.success) {
        alertsSent++;
      } else {
        errors.push(`Failed to create SMR alert for ${smr.id}: ${result.error}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error checking SMR deadlines:', err);
    errors.push(`SMR check error: ${message}`);
  }

  return { alertsSent, errors };
}

/**
 * Run all deadline checks for a single tenant.
 */
export async function runTenantDeadlineChecks(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DeadlineCheckResult> {
  console.log(`Running deadline checks for tenant ${tenantId}...`);

  const ttrResult = await checkTTRDeadlines(supabase, tenantId);
  const smrResult = await checkSMRDeadlines(supabase, tenantId);

  const result: DeadlineCheckResult = {
    ttrAlertsSent: ttrResult.alertsSent,
    smrAlertsSent: smrResult.alertsSent,
    errors: [...ttrResult.errors, ...smrResult.errors],
  };

  console.log(`Deadline checks complete for tenant ${tenantId}:`, {
    ttrAlerts: result.ttrAlertsSent,
    smrAlerts: result.smrAlertsSent,
    errorCount: result.errors.length,
  });

  // Log summary to audit
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'deadline_check_run',
    entity_type: 'system',
    description: `Daily deadline check: ${result.ttrAlertsSent} TTR alerts, ${result.smrAlertsSent} SMR alerts`,
    metadata: result,
  });

  return result;
}

/**
 * Run deadline checks for all active tenants.
 * This should be called by a cron job, ideally daily at 8 AM local time.
 */
export async function runAllTenantsDeadlineChecks(
  supabase: SupabaseClient
): Promise<{
  tenantsChecked: number;
  totalTtrAlerts: number;
  totalSmrAlerts: number;
  errors: string[];
}> {
  console.log('Starting deadline checks for all tenants...');

  // Get all active tenants
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('status', 'active');

  if (error) {
    console.error('Failed to fetch tenants:', error);
    return {
      tenantsChecked: 0,
      totalTtrAlerts: 0,
      totalSmrAlerts: 0,
      errors: [`Failed to fetch tenants: ${error.message}`],
    };
  }

  let totalTtrAlerts = 0;
  let totalSmrAlerts = 0;
  const allErrors: string[] = [];

  for (const tenant of tenants || []) {
    try {
      const result = await runTenantDeadlineChecks(supabase, tenant.id);
      totalTtrAlerts += result.ttrAlertsSent;
      totalSmrAlerts += result.smrAlertsSent;
      allErrors.push(...result.errors.map((e) => `[${tenant.id}] ${e}`));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      allErrors.push(`[${tenant.id}] Tenant check failed: ${message}`);
    }
  }

  console.log('All tenants deadline checks complete:', {
    tenantsChecked: tenants?.length || 0,
    totalTtrAlerts,
    totalSmrAlerts,
    errorCount: allErrors.length,
  });

  return {
    tenantsChecked: tenants?.length || 0,
    totalTtrAlerts,
    totalSmrAlerts,
    errors: allErrors,
  };
}
