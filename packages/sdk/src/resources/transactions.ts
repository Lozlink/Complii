import type { HttpClient } from '../utils/http';
import type { PaginatedResponse } from '../types';
import type {
  Transaction,
  TransactionCreateInput,
  TransactionListParams,
  TransactionBatchResponse,
} from '../types/transactions';

export interface TransactionUpdateInput {
  externalId?: string;
  description?: string;
  reviewStatus?: string;
  flaggedForReview?: boolean;
  metadata?: Record<string, unknown>;
}

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

  async update(id: string, input: TransactionUpdateInput): Promise<Transaction> {
    return this.http.patch<Transaction>(`/transactions/${id}`, input);
  }

  async delete(id: string): Promise<{ id: string; object: 'transaction'; deleted: boolean }> {
    return this.http.delete(`/transactions/${id}`);
  }

  async list(params?: TransactionListParams): Promise<PaginatedResponse<Transaction>> {
    return this.http.get<PaginatedResponse<Transaction>>('/transactions', params);
  }

  /**
   * Import transactions from CSV or Excel file
   * @param file - File object (browser) or file path/buffer (Node.js)
   * @param options - Import options
   */
  async importFile(
    file: File,
    options?: {
      skipDuplicates?: boolean;
      dryRun?: boolean;
    }
  ): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.skipDuplicates) {
      formData.append('skipDuplicates', 'true');
    }

    if (options?.dryRun) {
      formData.append('dryRun', 'true');
    }

    return this.http.post<ImportResult>('/transactions/import', formData);
  }

  /**
   * Download CSV template for imports
   */
  async downloadTemplate(): Promise<string> {
    const response = await fetch(
      `${this.http['baseUrl']}/transactions/import/template`,
      {
        headers: {
          Authorization: `Bearer ${this.http['apiKey']}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    return response.text();
  }
}

export interface ImportRowResult {
  rowNumber: number;
  status: 'success' | 'duplicate' | 'failed';
  transactionId?: string;
  customerId?: string;
  customerMatchMethod?: string;
  duplicateId?: string;
  duplicateMatchMethod?: string;
  error?: string;
  warnings?: string[];
}

export interface ImportResult {
  object: 'import_result';
  fileName: string;
  fileSize: number;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    succeeded: number;
    duplicates: number;
    failed: number;
  };
  results: ImportRowResult[];
  invalidRows: Array<{
    rowNumber: number;
    errors: string[];
    warnings: string[];
    data: Record<string, unknown>;
  }>;
  complianceProcessing: 'running' | 'skipped';
  dryRun: boolean;
}
