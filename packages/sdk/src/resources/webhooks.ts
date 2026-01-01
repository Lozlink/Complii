import type { HttpClient } from '../utils/http';
import type {
  WebhookEndpoint,
  WebhookCreateInput,
  WebhookUpdateInput,
} from '../types/webhooks';

interface WebhookListResponse {
  object: 'list';
  data: WebhookEndpoint[];
  totalCount: number;
}

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: WebhookCreateInput): Promise<WebhookEndpoint> {
    return this.http.post<WebhookEndpoint>('/webhooks', input);
  }

  async retrieve(id: string): Promise<WebhookEndpoint> {
    return this.http.get<WebhookEndpoint>(`/webhooks/${id}`);
  }

  async update(id: string, input: WebhookUpdateInput): Promise<WebhookEndpoint> {
    return this.http.patch<WebhookEndpoint>(`/webhooks/${id}`, input);
  }

  async delete(id: string): Promise<{ id: string; object: 'webhook_endpoint'; deleted: boolean }> {
    return this.http.delete(`/webhooks/${id}`);
  }

  async list(): Promise<WebhookListResponse> {
    return this.http.get<WebhookListResponse>('/webhooks');
  }
}
