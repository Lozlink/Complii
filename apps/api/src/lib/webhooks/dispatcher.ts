import { SupabaseClient } from '@supabase/supabase-js';
import { generateWebhookSignature } from './signature';
import crypto from 'crypto';

export type WebhookEventType =
  | 'customer.created'
  | 'transaction.created'
  | 'transaction.flagged'
  | 'transaction.ttr_required'
  | 'screening.match'
  | 'risk.high'
  // KYC events
  | 'kyc.verification_started'
  | 'kyc.verification_submitted'
  | 'kyc.verification_completed'
  | 'kyc.verification_failed'
  | 'kyc.document_uploaded'
  | 'kyc.document_reviewed'
  // Deadline events
  | 'deadline.ttr_approaching'
  | 'deadline.ttr_overdue'
  | 'deadline.smr_approaching'
  | 'deadline.smr_overdue'
  // Alert events
  | 'alert.created'
  | 'alert.escalated';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  created: string;
  data: {
    object: Record<string, unknown>;
  };
}

interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  status: string;
}

function generateEventId(): string {
  return `evt_${crypto.randomBytes(12).toString('hex')}`;
}

export async function dispatchWebhookEvent(
  supabase: SupabaseClient,
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  // Get active webhook endpoints subscribed to this event
  const { data: endpoints, error } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .contains('events', [eventType]);

  if (error) {
    console.error('Failed to fetch webhook endpoints:', error);
    return;
  }

  if (!endpoints || endpoints.length === 0) {
    return;
  }

  const event: WebhookEvent = {
    id: generateEventId(),
    type: eventType,
    created: new Date().toISOString(),
    data: {
      object: data,
    },
  };

  // Dispatch to all matching endpoints (fire and forget for now)
  await Promise.allSettled(
    endpoints.map((endpoint) => deliverWebhook(supabase, tenantId, endpoint, event))
  );
}

async function deliverWebhook(
  supabase: SupabaseClient,
  tenantId: string,
  endpoint: WebhookEndpoint,
  event: WebhookEvent
): Promise<void> {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateWebhookSignature(payload, endpoint.secret, timestamp);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let deliveryStatus: 'delivered' | 'failed' = 'failed';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Complii-Signature': signature,
        'X-Complii-Event': event.type,
        'X-Complii-Delivery': event.id,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    responseStatus = response.status;
    responseBody = await response.text().catch(() => null);

    if (response.ok) {
      deliveryStatus = 'delivered';
    }
  } catch (err) {
    console.error(`Webhook delivery failed for ${endpoint.url}:`, err);
    responseBody = err instanceof Error ? err.message : 'Unknown error';
  }

  // Log the delivery attempt
  await supabase.from('webhook_deliveries').insert({
    tenant_id: tenantId,
    webhook_endpoint_id: endpoint.id,
    event_id: event.id,
    event_type: event.type,
    payload: event,
    status: deliveryStatus,
    attempts: 1,
    response_status: responseStatus,
    response_body: responseBody,
    delivered_at: deliveryStatus === 'delivered' ? new Date().toISOString() : null,
  });
}

// Convenience functions for common events
export async function dispatchCustomerCreated(
  supabase: SupabaseClient,
  tenantId: string,
  customer: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'customer.created', customer);
}

export async function dispatchTransactionCreated(
  supabase: SupabaseClient,
  tenantId: string,
  transaction: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'transaction.created', transaction);
}

export async function dispatchTransactionFlagged(
  supabase: SupabaseClient,
  tenantId: string,
  transaction: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'transaction.flagged', transaction);
}

export async function dispatchTransactionTtrRequired(
  supabase: SupabaseClient,
  tenantId: string,
  transaction: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'transaction.ttr_required', transaction);
}

export async function dispatchScreeningMatch(
  supabase: SupabaseClient,
  tenantId: string,
  screening: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'screening.match', screening);
}

export async function dispatchRiskHigh(
  supabase: SupabaseClient,
  tenantId: string,
  assessment: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'risk.high', assessment);
}

// KYC webhook dispatch functions
export async function dispatchKycVerificationStarted(
  supabase: SupabaseClient,
  tenantId: string,
  data: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'kyc.verification_started', data);
}

export async function dispatchKycStatusChanged(
  supabase: SupabaseClient,
  tenantId: string,
  data: Record<string, unknown>
): Promise<void> {
  const status = data.status as string;
  let eventType: WebhookEventType;

  switch (status) {
    case 'verified':
      eventType = 'kyc.verification_completed';
      break;
    case 'rejected':
      eventType = 'kyc.verification_failed';
      break;
    default:
      eventType = 'kyc.verification_submitted';
  }

  await dispatchWebhookEvent(supabase, tenantId, eventType, data);
}

export async function dispatchDocumentUploaded(
  supabase: SupabaseClient,
  tenantId: string,
  data: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'kyc.document_uploaded', data);
}

export async function dispatchDocumentReviewed(
  supabase: SupabaseClient,
  tenantId: string,
  data: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'kyc.document_reviewed', data);
}

// Deadline webhook dispatch functions
export async function dispatchDeadlineAlert(
  supabase: SupabaseClient,
  tenantId: string,
  type: 'ttr' | 'smr',
  isOverdue: boolean,
  data: Record<string, unknown>
): Promise<void> {
  const eventType: WebhookEventType = isOverdue
    ? type === 'ttr'
      ? 'deadline.ttr_overdue'
      : 'deadline.smr_overdue'
    : type === 'ttr'
      ? 'deadline.ttr_approaching'
      : 'deadline.smr_approaching';

  await dispatchWebhookEvent(supabase, tenantId, eventType, data);
}

// Alert webhook dispatch functions
export async function dispatchAlertCreated(
  supabase: SupabaseClient,
  tenantId: string,
  alert: Record<string, unknown>
): Promise<void> {
  await dispatchWebhookEvent(supabase, tenantId, 'alert.created', alert);
}
