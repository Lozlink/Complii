import type { HttpClient } from '../utils/http';

export interface Tenant {
  id: string;
  object: 'tenant';
  name: string;
  email: string;
  region: string;
  plan: string;
  status: string;
  settings: Record<string, unknown>;
  monthlyScreeningLimit: number;
  monthlyScreeningsUsed: number;
  rateLimitPerMinute: number;
  liveApiKey?: string;
  testApiKey?: string;
  liveApiKeyPrefix?: string;
  testApiKeyPrefix?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantCreateInput {
  name: string;
  email: string;
  region?: string;
  plan?: string;
  settings?: Record<string, unknown>;
  monthlyScreeningLimit?: number;
  rateLimitPerMinute?: number;
}

export interface TenantUpdateInput {
  name?: string;
  email?: string;
  region?: string;
  plan?: string;
  status?: string;
  settings?: Record<string, unknown>;
  monthlyScreeningLimit?: number;
  rateLimitPerMinute?: number;
}

export interface TenantListParams {
  limit?: number;
  offset?: number;
  status?: string;
  [key: string]: string | number | undefined;
}

export interface TenantListResponse {
  object: 'list';
  data: Tenant[];
  hasMore: boolean;
  totalCount: number;
}

export class TenantsResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: TenantCreateInput): Promise<Tenant> {
    return this.http.post<Tenant>('/tenants', input);
  }

  async retrieve(id: string): Promise<Tenant> {
    return this.http.get<Tenant>(`/tenants/${id}`);
  }

  async update(id: string, input: TenantUpdateInput): Promise<Tenant> {
    return this.http.patch<Tenant>(`/tenants/${id}`, input);
  }

  async delete(id: string): Promise<{ id: string; object: 'tenant'; deleted: boolean }> {
    return this.http.delete(`/tenants/${id}`);
  }

  async list(params?: TenantListParams): Promise<TenantListResponse> {
    return this.http.get<TenantListResponse>('/tenants', params);
  }
}
