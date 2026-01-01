import type { HttpClient } from '../utils/http';

export interface AuditLog {
  id: string;
  object: 'audit_log';
  actionType: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  apiKeyPrefix?: string;
  createdAt: string;
}

export interface AuditLogListParams {
  limit?: number;
  offset?: number;
  entityType?: string;
  entityId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogListResponse {
  object: 'list';
  data: AuditLog[];
  hasMore: boolean;
  totalCount: number;
}

export class AuditLogsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params?: AuditLogListParams): Promise<AuditLogListResponse> {
    return this.http.get<AuditLogListResponse>('/audit-logs', params);
  }
}
