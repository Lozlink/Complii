export interface CustomerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface Customer {
  id: string;
  object: 'customer';
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  externalId?: string;
  address?: CustomerAddress;
  phone?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  isPep: boolean;
  isSanctioned: boolean;
  lastScreenedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCreateInput {
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  externalId?: string;
  address?: CustomerAddress;
  phone?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerUpdateInput {
  email?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  address?: CustomerAddress;
  phone?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  isPep?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CustomerListParams {
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
  email?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  [key: string]: string | number | boolean | undefined;
}

export interface CustomerBatchResult {
  externalId?: string;
  email: string;
  id?: string;
  status: 'created' | 'exists' | 'failed';
  error?: string;
}

export interface CustomerBatchResponse {
  object: 'batch_result';
  succeeded: number;
  failed: number;
  total: number;
  results: CustomerBatchResult[];
}
