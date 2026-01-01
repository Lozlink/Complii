import type { HttpClient } from '../utils/http';
import type { PaginatedResponse } from '../types';
import type {
  Customer,
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerListParams,
  CustomerBatchResponse,
} from '../types/customers';

export class CustomersResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: CustomerCreateInput): Promise<Customer> {
    return this.http.post<Customer>('/customers', input);
  }

  async createBatch(customers: CustomerCreateInput[]): Promise<CustomerBatchResponse> {
    return this.http.post<CustomerBatchResponse>('/customers/batch', { customers });
  }

  async retrieve(id: string): Promise<Customer> {
    return this.http.get<Customer>(`/customers/${id}`);
  }

  async update(id: string, input: CustomerUpdateInput): Promise<Customer> {
    return this.http.patch<Customer>(`/customers/${id}`, input);
  }

  async delete(id: string): Promise<{ id: string; object: 'customer'; deleted: boolean }> {
    return this.http.delete(`/customers/${id}`);
  }

  async list(params?: CustomerListParams): Promise<PaginatedResponse<Customer>> {
    return this.http.get<PaginatedResponse<Customer>>('/customers', params);
  }
}
