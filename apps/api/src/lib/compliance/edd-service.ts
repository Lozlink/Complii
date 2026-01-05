import { SupabaseClient } from '@supabase/supabase-js';
import { dispatchWebhookEvent } from '../webhooks/dispatcher';

export interface EDDInvestigation {
  id: string;
  investigation_number: string;
  tenant_id: string;
  customer_id: string;
  transaction_id: string | null;
  status: string;
  trigger_reason: string;
  triggered_by: string;
  assigned_to: string | null;
  opened_at: string;
  created_at: string;
}

export interface CreateEDDParams {
  customerId: string;
  transactionId?: string | null;
  triggerReason: string;
  triggeredBy?: 'admin' | 'system' | 'transaction_review';
  assignedTo?: string | null;
}

export interface EDDResult {
  success: boolean;
  investigation?: EDDInvestigation;
  existingInvestigation?: { id: string; investigation_number: string };
  error?: string;
}

/**
 * Create a new EDD investigation for a customer.
 * Will return existing investigation if one is already open.
 */
export async function createEDDInvestigation(
  supabase: SupabaseClient,
  tenantId: string,
  params: CreateEDDParams
): Promise<EDDResult> {
  const {
    customerId,
    transactionId,
    triggerReason,
    triggeredBy = 'system',
    assignedTo = null,
  } = params;

  // Check for existing open investigation
  const { data: existing } = await supabase
    .from('edd_investigations')
    .select('id, investigation_number')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .in('status', ['open', 'awaiting_customer_info', 'under_review', 'escalated'])
    .single();

  if (existing) {
    // If transaction provided, link it to existing investigation
    if (transactionId) {
      await supabase
        .from('transactions')
        .update({ edd_investigation_id: existing.id })
        .eq('id', transactionId)
        .eq('tenant_id', tenantId);
    }

    return {
      success: false,
      error: 'Customer already has an active investigation',
      existingInvestigation: existing,
    };
  }

  // Create investigation
  const { data: investigation, error: createError } = await supabase
    .from('edd_investigations')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      transaction_id: transactionId || null,
      trigger_reason: triggerReason,
      triggered_by: triggeredBy,
      assigned_to: assignedTo,
      status: 'open',
    })
    .select()
    .single();

  if (createError) {
    console.error('Failed to create EDD investigation:', createError);
    return { success: false, error: createError.message };
  }

  // Update customer flags
  await supabase
    .from('customers')
    .update({
      requires_edd: true,
      edd_completed_at: null,
    })
    .eq('id', customerId)
    .eq('tenant_id', tenantId);

  // Link transaction if provided
  if (transactionId) {
    await supabase
      .from('transactions')
      .update({ edd_investigation_id: investigation.id })
      .eq('id', transactionId)
      .eq('tenant_id', tenantId);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'edd_investigation_created',
    entity_type: 'edd_investigation',
    entity_id: investigation.id,
    description: `EDD investigation created: ${triggerReason}`,
    metadata: {
      investigation_number: investigation.investigation_number,
      customer_id: customerId,
      transaction_id: transactionId,
      triggered_by: triggeredBy,
    },
  });

  // Dispatch webhook
  await dispatchWebhookEvent(supabase, tenantId, 'customer.created', {
    type: 'edd.investigation_created',
    investigationId: investigation.id,
    investigationNumber: investigation.investigation_number,
    customerId,
    transactionId,
    triggerReason,
    triggeredBy,
  });

  return { success: true, investigation };
}

/**
 * Update EDD investigation status
 */
export async function updateEDDStatus(
  supabase: SupabaseClient,
  tenantId: string,
  investigationId: string,
  status: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const validStatuses = [
    'open',
    'awaiting_customer_info',
    'under_review',
    'escalated',
    'completed_approved',
    'completed_rejected',
    'completed_ongoing_monitoring',
  ];

  if (!validStatuses.includes(status)) {
    return { success: false, error: `Invalid status: ${status}` };
  }

  const updates: Record<string, unknown> = { status };

  // Set completed_at if status is a completion status
  if (status.startsWith('completed_')) {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('edd_investigations')
    .update(updates)
    .eq('id', investigationId)
    .eq('tenant_id', tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'edd_investigation_updated',
    entity_type: 'edd_investigation',
    entity_id: investigationId,
    description: `EDD investigation status updated to: ${status}`,
    metadata: { status, ...metadata },
  });

  return { success: true };
}

/**
 * Complete an EDD investigation with findings
 */
export async function completeEDDInvestigation(
  supabase: SupabaseClient,
  tenantId: string,
  investigationId: string,
  params: {
    investigationFindings: string;
    riskAssessmentSummary: string;
    complianceRecommendation:
      | 'approve_relationship'
      | 'ongoing_monitoring'
      | 'enhanced_monitoring'
      | 'reject_relationship'
      | 'escalate_to_smr';
    reviewedBy?: string;
  }
): Promise<{ success: boolean; error?: string; monitoringLevel?: string }> {
  const {
    investigationFindings,
    riskAssessmentSummary,
    complianceRecommendation,
    reviewedBy,
  } = params;

  // Map recommendation to status and monitoring level
  const statusMap: Record<string, string> = {
    approve_relationship: 'completed_approved',
    ongoing_monitoring: 'completed_ongoing_monitoring',
    enhanced_monitoring: 'completed_ongoing_monitoring',
    reject_relationship: 'completed_rejected',
    escalate_to_smr: 'completed_rejected',
  };

  const monitoringMap: Record<string, string> = {
    approve_relationship: 'standard',
    ongoing_monitoring: 'ongoing_review',
    enhanced_monitoring: 'enhanced',
    reject_relationship: 'blocked',
    escalate_to_smr: 'blocked',
  };

  const newStatus = statusMap[complianceRecommendation];
  const monitoringLevel = monitoringMap[complianceRecommendation];

  // Get investigation to find customer
  const { data: investigation } = await supabase
    .from('edd_investigations')
    .select('customer_id')
    .eq('id', investigationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!investigation) {
    return { success: false, error: 'Investigation not found' };
  }

  // Update investigation
  const { error: updateError } = await supabase
    .from('edd_investigations')
    .update({
      investigation_findings: investigationFindings,
      risk_assessment_summary: riskAssessmentSummary,
      compliance_recommendation: complianceRecommendation,
      status: newStatus,
      reviewed_by: reviewedBy,
      completed_at: new Date().toISOString(),
    })
    .eq('id', investigationId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Update customer
  await supabase
    .from('customers')
    .update({
      requires_edd: false,
      edd_completed_at: new Date().toISOString(),
      edd_next_review_at:
        complianceRecommendation === 'enhanced_monitoring'
          ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
          : complianceRecommendation === 'ongoing_monitoring'
            ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() // 180 days
            : null,
    })
    .eq('id', investigation.customer_id)
    .eq('tenant_id', tenantId);

  // Audit log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'edd_investigation_completed',
    entity_type: 'edd_investigation',
    entity_id: investigationId,
    description: `EDD investigation completed: ${complianceRecommendation}`,
    metadata: {
      recommendation: complianceRecommendation,
      monitoring_level: monitoringLevel,
      reviewed_by: reviewedBy,
    },
  });

  // Dispatch webhook
  await dispatchWebhookEvent(supabase, tenantId, 'customer.created', {
    type: 'edd.investigation_completed',
    investigationId,
    customerId: investigation.customer_id,
    recommendation: complianceRecommendation,
    monitoringLevel,
  });

  return { success: true, monitoringLevel };
}

/**
 * Request additional information from customer
 */
export async function requestEDDInformation(
  supabase: SupabaseClient,
  tenantId: string,
  investigationId: string,
  params: {
    items: string[];
    deadline?: string;
    requestedBy?: string;
  }
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  const { items, deadline, requestedBy } = params;

  // Get current investigation
  const { data: investigation } = await supabase
    .from('edd_investigations')
    .select('information_requests')
    .eq('id', investigationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!investigation) {
    return { success: false, error: 'Investigation not found' };
  }

  const requestId = crypto.randomUUID();
  const newRequest = {
    id: requestId,
    requested_at: new Date().toISOString(),
    requested_by: requestedBy,
    items,
    deadline: deadline || null,
    status: 'pending',
    received_at: null,
    response_notes: null,
  };

  const updatedRequests = [
    ...((investigation.information_requests as unknown[]) || []),
    newRequest,
  ];

  // Update investigation
  const { error } = await supabase
    .from('edd_investigations')
    .update({
      information_requests: updatedRequests,
      status: 'awaiting_customer_info',
    })
    .eq('id', investigationId)
    .eq('tenant_id', tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'edd_information_requested',
    entity_type: 'edd_investigation',
    entity_id: investigationId,
    description: `Information requested: ${items.join(', ')}`,
    metadata: { items, deadline, request_id: requestId },
  });

  return { success: true, requestId };
}

/**
 * Escalate an EDD investigation
 */
export async function escalateEDDInvestigation(
  supabase: SupabaseClient,
  tenantId: string,
  investigationId: string,
  params: {
    reason: string;
    escalatedTo?: string;
    escalatedBy?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { reason, escalatedTo = 'management', escalatedBy } = params;

  // Get current investigation
  const { data: investigation } = await supabase
    .from('edd_investigations')
    .select('escalations')
    .eq('id', investigationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!investigation) {
    return { success: false, error: 'Investigation not found' };
  }

  const newEscalation = {
    id: crypto.randomUUID(),
    escalated_at: new Date().toISOString(),
    escalated_by: escalatedBy,
    escalated_to: escalatedTo,
    reason,
    resolved: false,
    resolved_at: null,
    resolution_notes: null,
  };

  const updatedEscalations = [
    ...((investigation.escalations as unknown[]) || []),
    newEscalation,
  ];

  // Update investigation
  const { error } = await supabase
    .from('edd_investigations')
    .update({
      escalations: updatedEscalations,
      status: 'escalated',
    })
    .eq('id', investigationId)
    .eq('tenant_id', tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'edd_investigation_escalated',
    entity_type: 'edd_investigation',
    entity_id: investigationId,
    description: `Investigation escalated: ${reason}`,
    metadata: { reason, escalated_to: escalatedTo },
  });

  return { success: true };
}

/**
 * Check if a customer requires EDD based on various factors
 */
export function shouldTriggerEDD(params: {
  riskScore: number;
  riskLevel: string;
  isPep: boolean;
  isSanctioned: boolean;
  transactionAmount: number;
  eddThreshold: number;
  hasStructuringAlert: boolean;
}): { shouldTrigger: boolean; reason?: string } {
  const {
    riskScore,
    riskLevel,
    isPep,
    isSanctioned,
    transactionAmount,
    eddThreshold,
    hasStructuringAlert,
  } = params;

  if (isSanctioned) {
    return { shouldTrigger: true, reason: 'Customer has sanctions match' };
  }

  if (isPep && riskScore >= 50) {
    return { shouldTrigger: true, reason: 'PEP with elevated risk score' };
  }

  if (riskLevel === 'high') {
    return { shouldTrigger: true, reason: 'High risk customer' };
  }

  if (transactionAmount >= eddThreshold) {
    return {
      shouldTrigger: true,
      reason: `Transaction exceeds EDD threshold (${transactionAmount} >= ${eddThreshold})`,
    };
  }

  if (hasStructuringAlert) {
    return { shouldTrigger: true, reason: 'Structuring pattern detected' };
  }

  return { shouldTrigger: false };
}
