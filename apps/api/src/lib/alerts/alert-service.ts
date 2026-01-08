import { SupabaseClient } from '@supabase/supabase-js';

export interface AlertInput {
  tenantId: string;
  ruleCode: string;
  title: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  entityType: 'customer' | 'transaction' | 'document' | 'screening';
  entityId: string;
  customerId?: string;
  triggerData: Record<string, unknown>;
  autoCreateCase?: boolean;
  slaHours?: number;
}

export interface AlertResult {
  success: boolean;
  alertId?: string;
  alertNumber?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Creates a compliance alert for tenant action
 * Respects cooldown periods and rate limits
 */
export async function createAlert(
  supabase: SupabaseClient,
  input: AlertInput
): Promise<AlertResult> {
  try {
    const { tenantId, ruleCode, entityType, entityId, customerId, severity, title, description, triggerData, autoCreateCase, slaHours } = input;

    // Get the alert rule (if exists)
    const { data: rule } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('rule_code', ruleCode)
      .eq('is_enabled', true)
      .maybeSingle();

    // Check cooldown period to prevent alert spam
    if (rule?.cooldown_minutes) {
      const cooldownStart = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
      const { data: recentAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .gte('created_at', cooldownStart.toISOString())
        .maybeSingle();

      if (recentAlert) {
        return {
          success: false,
          skipped: true,
          skipReason: `Alert for ${entityType} ${entityId} already triggered within cooldown period (${rule.cooldown_minutes} minutes)`,
        };
      }
    }

    // Check daily rate limit
    if (rule?.max_alerts_per_day) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('alert_rule_id', rule.id)
        .gte('created_at', todayStart.toISOString());

      if (count && count >= rule.max_alerts_per_day) {
        return {
          success: false,
          skipped: true,
          skipReason: `Daily rate limit reached for rule ${ruleCode} (${rule.max_alerts_per_day} alerts/day)`,
        };
      }
    }

    // Generate alert number
    const { data: alertNumberData } = await supabase.rpc('generate_alert_number', {
      p_tenant_id: tenantId,
    });
    const alertNumber = alertNumberData || `ALT-${Date.now()}`;

    // Calculate SLA deadline
    let slaDeadline: string | null = null;
    if (slaHours) {
      const deadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);
      slaDeadline = deadline.toISOString();
    }

    // Create the alert
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        tenant_id: tenantId,
        alert_rule_id: rule?.id || null,
        alert_number: alertNumber,
        title,
        description,
        severity: rule?.severity || severity,
        entity_type: entityType,
        entity_id: entityId,
        customer_id: customerId || null,
        trigger_data: triggerData,
        status: 'new',
        sla_deadline: slaDeadline,
        metadata: {
          rule_code: ruleCode,
          auto_created: true,
        },
      })
      .select('id, alert_number')
      .single();

    if (error) {
      console.error('Failed to create alert:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Auto-create case if configured
    if ((rule?.auto_create_case || autoCreateCase) && rule?.case_type) {
      await supabase.from('cases').insert({
        tenant_id: tenantId,
        case_type: rule.case_type,
        priority: rule.case_priority || 'medium',
        customer_id: customerId || null,
        title: `Case: ${title}`,
        description,
        status: 'open',
        metadata: {
          alert_id: alert.id,
          alert_number: alertNumber,
          triggered_by_rule: ruleCode,
        },
      });

      await supabase
        .from('alerts')
        .update({ status: 'escalated' })
        .eq('id', alert.id);
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action_type: 'alert.created',
      entity_type: 'alert',
      entity_id: alert.id,
      description: `Alert ${alertNumber} created: ${title}`,
      metadata: { alertNumber, ruleCode, severity, entityType, entityId },
    });

    return {
      success: true,
      alertId: alert.id,
      alertNumber: alert.alert_number,
    };
  } catch (error) {
    console.error('Alert creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Creates multiple alerts in batch
 */
export async function createAlertsBatch(
  supabase: SupabaseClient,
  alerts: AlertInput[]
): Promise<AlertResult[]> {
  const results: AlertResult[] = [];

  for (const alertInput of alerts) {
    const result = await createAlert(supabase, alertInput);
    results.push(result);
  }

  return results;
}

/**
 * Common alert generators for compliance events
 */
export const AlertGenerators = {
  /**
   * Alert for high-value transaction (TTR threshold)
   */
  ttrThreshold: (
    tenantId: string,
    transactionId: string,
    customerId: string,
    amount: number,
    currency: string
  ): AlertInput => ({
    tenantId,
    ruleCode: 'TXN_TTR_THRESHOLD',
    title: `Transaction requires TTR (${currency} ${amount.toLocaleString()})`,
    description: `Transaction amount meets or exceeds TTR reporting threshold. TTR must be submitted within 10 business days.`,
    severity: 'high',
    entityType: 'transaction',
    entityId: transactionId,
    customerId,
    triggerData: { amount, currency, threshold: 'ttr' },
    slaHours: 240, // 10 business days (estimate)
  }),

  /**
   * Alert for sanctions match
   */
  sanctionsMatch: (
    tenantId: string,
    customerId: string,
    matchScore: number,
    matchedName: string,
    source: string
  ): AlertInput => ({
    tenantId,
    ruleCode: 'SANCTIONS_MATCH',
    title: `Sanctions screening match detected`,
    description: `Customer matched against ${source} sanctions list: "${matchedName}" (${(matchScore * 100).toFixed(0)}% confidence). Immediate review required.`,
    severity: 'critical',
    entityType: 'customer',
    entityId: customerId,
    customerId,
    triggerData: { matchScore, matchedName, source },
    autoCreateCase: true,
    slaHours: 4, // Urgent review
  }),

  /**
   * Alert for PEP detection
   */
  pepDetection: (
    tenantId: string,
    customerId: string,
    matchScore: number,
    matchedName: string
  ): AlertInput => ({
    tenantId,
    ruleCode: 'PEP_DETECTION',
    title: `Politically Exposed Person (PEP) detected`,
    description: `Customer identified as PEP: "${matchedName}" (${(matchScore * 100).toFixed(0)}% confidence). Enhanced due diligence required.`,
    severity: 'high',
    entityType: 'customer',
    entityId: customerId,
    customerId,
    triggerData: { matchScore, matchedName, pep: true },
    autoCreateCase: true,
    slaHours: 24,
  }),

  /**
   * Alert for structuring detection
   */
  structuringDetected: (
    tenantId: string,
    customerId: string,
    transactionCount: number,
    totalAmount: number,
    indicators: string[]
  ): AlertInput => ({
    tenantId,
    ruleCode: 'STRUCTURING_DETECTED',
    title: `Potential structuring activity detected`,
    description: `Customer has ${transactionCount} suspicious transactions totaling ${totalAmount.toLocaleString()}. Indicators: ${indicators.join('; ')}. SMR may be required.`,
    severity: 'critical',
    entityType: 'customer',
    entityId: customerId,
    customerId,
    triggerData: { transactionCount, totalAmount, indicators },
    autoCreateCase: true,
    slaHours: 24,
  }),

  /**
   * Alert for high risk score
   */
  highRiskScore: (
    tenantId: string,
    entityType: 'customer' | 'transaction',
    entityId: string,
    customerId: string,
    riskScore: number,
    riskLevel: string,
    factors: Array<{ factor: string; score: number; reason: string }>
  ): AlertInput => ({
    tenantId,
    ruleCode: 'HIGH_RISK_SCORE',
    title: `High risk ${entityType} detected (score: ${riskScore})`,
    description: `Risk level: ${riskLevel}. Key factors: ${factors.map(f => f.reason).join('; ')}`,
    severity: riskScore >= 80 ? 'critical' : 'high',
    entityType,
    entityId,
    customerId,
    triggerData: { riskScore, riskLevel, factors },
    slaHours: 48,
  }),

  /**
   * Alert for SMR created
   */
  smrCreated: (
    tenantId: string,
    smrId: string,
    customerId: string,
    reportNumber: string,
    activityType: string,
    deadlineDate: string
  ): AlertInput => ({
    tenantId,
    ruleCode: 'SMR_CREATED',
    title: `SMR ${reportNumber} requires submission`,
    description: `Suspicious Matter Report created for ${activityType}. Must be submitted to AUSTRAC by ${new Date(deadlineDate).toLocaleDateString()}.`,
    severity: 'critical',
    entityType: 'customer',
    entityId: customerId,
    customerId,
    triggerData: { smrId, reportNumber, activityType, deadline: deadlineDate },
    slaHours: 72, // 3 business days
  }),

  /**
   * Alert for EDD investigation triggered
   */
  eddTriggered: (
    tenantId: string,
    customerId: string,
    investigationNumber: string,
    triggerReason: string
  ): AlertInput => ({
    tenantId,
    ruleCode: 'EDD_TRIGGERED',
    title: `EDD investigation ${investigationNumber} opened`,
    description: `Enhanced Due Diligence investigation triggered: ${triggerReason}. Customer information must be collected and reviewed.`,
    severity: 'high',
    entityType: 'customer',
    entityId: customerId,
    customerId,
    triggerData: { investigationNumber, triggerReason },
    slaHours: 120, // 5 business days to complete
  }),

  /**
   * Alert for KYC verification required
   */
  kycRequired: (
    tenantId: string,
    customerId: string,
    transactionAmount: number,
    threshold: number
  ): AlertInput => ({
    tenantId,
    ruleCode: 'KYC_REQUIRED',
    title: `KYC verification required for customer`,
    description: `Transaction amount (${transactionAmount.toLocaleString()}) exceeds KYC threshold (${threshold.toLocaleString()}). Customer identity must be verified before transaction can proceed.`,
    severity: 'medium',
    entityType: 'customer',
    entityId: customerId,
    customerId,
    triggerData: { transactionAmount, threshold },
    slaHours: 48,
  }),

  /**
   * Alert for deadline approaching
   */
  deadlineApproaching: (
    tenantId: string,
    reportType: 'TTR' | 'SMR' | 'IFTI',
    reportId: string,
    customerId: string | null,
    daysRemaining: number,
    deadline: string
  ): AlertInput => ({
    tenantId,
    ruleCode: `${reportType}_DEADLINE_APPROACHING`,
    title: `${reportType} deadline in ${daysRemaining} day(s)`,
    description: `${reportType} report must be submitted by ${new Date(deadline).toLocaleDateString()}. ${daysRemaining} day(s) remaining.`,
    severity: daysRemaining <= 1 ? 'critical' : daysRemaining <= 2 ? 'high' : 'medium',
    entityType: 'transaction',
    entityId: reportId,
    customerId: customerId || undefined,
    triggerData: { reportType, daysRemaining, deadline },
    slaHours: daysRemaining * 24,
  }),
};
