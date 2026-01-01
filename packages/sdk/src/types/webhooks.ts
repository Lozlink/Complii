export type WebhookEventType =
  | 'customer.created'
  | 'transaction.created'
  | 'transaction.flagged'
  | 'transaction.ttr_required'
  | 'screening.match'
  | 'risk.high';

export interface WebhookEndpoint {
  id: string;
  object: 'webhook_endpoint';
  url: string;
  events: WebhookEventType[];
  description?: string;
  status: 'active' | 'disabled';
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookCreateInput {
  url: string;
  events: WebhookEventType[];
  description?: string;
}

export interface WebhookUpdateInput {
  url?: string;
  events?: WebhookEventType[];
  description?: string;
  status?: 'active' | 'disabled';
}

export interface WebhookEvent<T = Record<string, unknown>> {
  id: string;
  type: WebhookEventType;
  created: string;
  data: {
    object: T;
  };
}
