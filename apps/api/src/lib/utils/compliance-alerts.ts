import { Resend } from 'resend';
import { getServiceClient } from '../db/client';

const resend = new Resend(process.env.RESEND_API_KEY);

export type ComplianceAlertType =
  | 'ttr_created'
  | 'ttr_deadline'
  | 'smr_created'
  | 'smr_deadline'
  | 'ifti_created'
  | 'ifti_deadline'
  | 'sanctions_match'
  | 'transaction_flagged'
  | 'edd_investigation_opened'
  | 'ocdd_overdue'
  | 'ocdd_due_soon'
  | 'alert_escalated';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ComplianceAlertOptions {
  type: ComplianceAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  tenantId: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

const SEVERITY_EMOJIS: Record<AlertSeverity, string> = {
  critical: '🚨',
  high: '⚠️',
  medium: '🔔',
  low: 'ℹ️',
};

const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fee2e2', text: '#991b1b', border: '#dc2626' },
  high: { bg: '#fed7aa', text: '#9a3412', border: '#ea580c' },
  medium: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  low: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
};

function generateEmailHtml(options: ComplianceAlertOptions): string {
  const { severity, title, description, actionUrl } = options;
  const colors = SEVERITY_COLORS[severity];
  const emoji = SEVERITY_EMOJIS[severity];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1f2937; margin: 0; font-size: 24px;">Complii Compliance Alert</h1>
      <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Automated Compliance Monitoring</p>
    </div>

    <!-- Alert Box -->
    <div style="background-color: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <div style="font-size: 32px; text-align: center; margin-bottom: 10px;">${emoji}</div>
      <h2 style="color: ${colors.text}; margin: 0 0 10px 0; font-size: 20px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
        ${severity} Alert
      </h2>
      <h3 style="color: #111827; margin: 0 0 10px 0; font-size: 18px;">${title}</h3>
      <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;">${description}</p>
    </div>

    ${
      actionUrl
        ? `
    <!-- Action Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${actionUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        View Details →
      </a>
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        This is an automated compliance alert from your Complii platform.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
        Generated at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send a compliance alert email to configured recipients
 * Uses COMPLIANCE_ALERT_EMAILS environment variable for recipients
 */
export async function sendComplianceAlert(options: ComplianceAlertOptions): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('[Compliance Alert] RESEND_API_KEY not configured');
      return;
    }

    // Get alert recipients from environment or tenant settings
    const recipients = process.env.COMPLIANCE_ALERT_EMAILS?.split(',').map((e) => e.trim()) || [];

    if (recipients.length === 0) {
      console.warn('[Compliance Alert] No recipients configured for compliance alerts');
      return;
    }

    const supabase = getServiceClient();

    // Fetch tenant name for personalization
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', options.tenantId)
      .single();

    const tenantName = tenant?.name || 'Your Organization';
    const subject = `${SEVERITY_EMOJIS[options.severity]} [${options.severity.toUpperCase()}] ${options.title}`;
    const html = generateEmailHtml(options);

    // Send email via Resend
    const result = await resend.emails.send({
      from: 'Complii Alerts <alerts@resend.dev>',
      to: recipients,
      subject,
      html,
    });

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      tenant_id: options.tenantId,
      action_type: 'compliance_alert_sent',
      entity_type: 'system',
      entity_id: null,
      description: `Sent ${options.severity} compliance alert: ${options.title}`,
      metadata: {
        alert_type: options.type,
        severity: options.severity,
        recipients: recipients.length,
        email_id: result.data?.id,
        ...options.metadata,
      },
    });

    console.log(
      `[Compliance Alert] Sent ${options.type} alert to ${recipients.length} recipient(s). Email ID: ${result.data?.id}`
    );
  } catch (error) {
    console.error('[Compliance Alert] Failed to send alert:', error);
  }
}

/**
 * Send TTR deadline alert
 */
export async function sendTTRDeadlineAlert(
  tenantId: string,
  daysRemaining: number,
  ttrCount: number,
  actionUrl?: string
): Promise<void> {
  const severity: AlertSeverity = daysRemaining === 0 ? 'critical' : daysRemaining <= 2 ? 'high' : 'medium';

  await sendComplianceAlert({
    type: 'ttr_deadline',
    severity,
    tenantId,
    title: daysRemaining === 0 ? 'TTR Deadline TODAY' : `TTR Deadline in ${daysRemaining} days`,
    description:
      daysRemaining === 0
        ? `${ttrCount} Threshold Transaction Report(s) are due for submission to AUSTRAC TODAY. Immediate action required to avoid penalties.`
        : `${ttrCount} Threshold Transaction Report(s) require submission to AUSTRAC within ${daysRemaining} business day(s). Please review and submit promptly.`,
    actionUrl,
    metadata: { days_remaining: daysRemaining, ttr_count: ttrCount },
  });
}

/**
 * Send SMR deadline alert
 */
export async function sendSMRDeadlineAlert(
  tenantId: string,
  daysRemaining: number,
  smrCount: number,
  actionUrl?: string
): Promise<void> {
  const severity: AlertSeverity = daysRemaining === 0 ? 'critical' : daysRemaining === 1 ? 'high' : 'medium';

  await sendComplianceAlert({
    type: 'smr_deadline',
    severity,
    tenantId,
    title: daysRemaining === 0 ? 'SMR Deadline TODAY' : `SMR Deadline in ${daysRemaining} days`,
    description:
      daysRemaining === 0
        ? `${smrCount} Suspicious Matter Report(s) must be submitted to AUSTRAC TODAY. Critical compliance deadline.`
        : `${smrCount} Suspicious Matter Report(s) require submission to AUSTRAC within ${daysRemaining} business day(s). AUSTRAC requires SMRs within 3 business days.`,
    actionUrl,
    metadata: { days_remaining: daysRemaining, smr_count: smrCount },
  });
}

/**
 * Send OCDD overdue alert
 */
export async function sendOCDDOverdueAlert(
  tenantId: string,
  overdueCount: number,
  actionUrl?: string
): Promise<void> {
  await sendComplianceAlert({
    type: 'ocdd_overdue',
    severity: 'high',
    tenantId,
    title: 'OCDD Reviews Overdue',
    description: `${overdueCount} customer(s) have overdue Ongoing Customer Due Diligence reviews. Regular OCDD is required to maintain AML/CTF compliance.`,
    actionUrl,
    metadata: { overdue_count: overdueCount },
  });
}

/**
 * Send OCDD due soon alert
 */
export async function sendOCDDDueSoonAlert(
  tenantId: string,
  dueCount: number,
  daysAhead: number,
  actionUrl?: string
): Promise<void> {
  await sendComplianceAlert({
    type: 'ocdd_due_soon',
    severity: 'medium',
    tenantId,
    title: `OCDD Reviews Due Within ${daysAhead} Days`,
    description: `${dueCount} customer(s) require Ongoing Customer Due Diligence review within ${daysAhead} day(s). Please schedule reviews to maintain compliance.`,
    actionUrl,
    metadata: { due_count: dueCount, days_ahead: daysAhead },
  });
}

/**
 * Send sanctions match alert
 */
export async function sendSanctionsMatchAlert(
  tenantId: string,
  customerName: string,
  matchScore: number,
  customerId: string
): Promise<void> {
  await sendComplianceAlert({
    type: 'sanctions_match',
    severity: 'critical',
    tenantId,
    title: 'Sanctions Match Detected',
    description: `Customer "${customerName}" matched against sanctions database with ${matchScore}% confidence. Immediate review and action required.`,
    actionUrl: `/dashboard/customers/${customerId}`,
    metadata: { customer_name: customerName, match_score: matchScore, customer_id: customerId },
  });
}

/**
 * Send transaction flagged alert
 */
export async function sendTransactionFlaggedAlert(
  tenantId: string,
  transactionId: string,
  amount: number,
  currency: string,
  riskScore: number
): Promise<void> {
  await sendComplianceAlert({
    type: 'transaction_flagged',
    severity: riskScore >= 80 ? 'high' : 'medium',
    tenantId,
    title: 'High-Risk Transaction Flagged',
    description: `Transaction of ${currency} ${amount.toLocaleString()} flagged for review with risk score ${riskScore}/100. Manual review required.`,
    actionUrl: `/dashboard/transactions/${transactionId}`,
    metadata: { transaction_id: transactionId, amount, currency, risk_score: riskScore },
  });
}

/**
 * Send EDD investigation opened alert
 */
export async function sendEDDInvestigationAlert(
  tenantId: string,
  customerId: string,
  customerName: string,
  investigationNumber: string,
  triggerReason: string
): Promise<void> {
  await sendComplianceAlert({
    type: 'edd_investigation_opened',
    severity: 'high',
    tenantId,
    title: 'EDD Investigation Opened',
    description: `Enhanced Due Diligence investigation ${investigationNumber} opened for customer "${customerName}". Reason: ${triggerReason}`,
    actionUrl: `/dashboard/edd/${investigationNumber}`,
    metadata: {
      customer_id: customerId,
      customer_name: customerName,
      investigation_number: investigationNumber,
      trigger_reason: triggerReason,
    },
  });
}
