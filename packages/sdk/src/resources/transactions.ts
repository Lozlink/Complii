import type { HttpClient } from '../utils/http';
import type { PaginatedResponse } from '../types';
import type {
  Transaction,
  TransactionCreateInput,
  TransactionListParams,
  TransactionBatchResponse,
} from '../types/transactions';

export class TransactionsResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: TransactionCreateInput): Promise<Transaction> {
    return this.http.post<Transaction>('/transactions', input);
  }

  async createBatch(transactions: TransactionCreateInput[]): Promise<TransactionBatchResponse> {
    return this.http.post<TransactionBatchResponse>('/transactions/batch', { transactions });
  }

  async retrieve(id: string): Promise<Transaction> {
    return this.http.get<Transaction>(`/transactions/${id}`);
  }

  async list(params?: TransactionListParams): Promise<PaginatedResponse<Transaction>> {
    return this.http.get<PaginatedResponse<Transaction>>('/transactions', params);
  }
}
