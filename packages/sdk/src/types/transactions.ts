export interface Transaction {
  id: string;
  object: 'transaction';
  customerId: string;
  externalId?: string;
  amount: number;
  currency: string;
  amountLocal?: number;
  direction: 'incoming' | 'outgoing';
  type?: string;
  description?: string;
  requiresTtr: boolean;
  ttrGeneratedAt?: string;
  ttrReference?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  flaggedForReview: boolean;
  reviewStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TransactionCreateInput {
  customerId: string;
  externalId?: string;
  amount: number;
  currency?: string;
  direction: 'incoming' | 'outgoing';
  type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionListParams {
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
  customerId?: string;
  flaggedForReview?: boolean;
  requiresTtr?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface TransactionBatchResult {
  externalId?: string;
  customerId: string;
  id?: string;
  status: 'created' | 'failed';
  requiresTtr?: boolean;
  ttrReference?: string;
  error?: string;
}

export interface TransactionBatchResponse {
  object: 'batch_result';
  succeeded: number;
  failed: number;
  total: number;
  results: TransactionBatchResult[];
}
