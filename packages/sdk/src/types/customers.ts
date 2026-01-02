export interface CustomerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export type CustomerType = 'individual' | 'business';

export type BusinessStructure =
  | 'sole_trader'
  | 'partnership'
  | 'pty_ltd'
  | 'public_company'
  | 'trust'
  | 'non_profit'
  | 'government'
  | 'other';

export interface Customer {
  id: string;
  object: 'customer';
  customerType: CustomerType;
  email: string;

  // Individual fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;

  // Business fields
  companyName?: string;
  tradingName?: string;
  companyRegistrationNumber?: string;
  abn?: string; // Australian Business Number
  acn?: string; // Australian Company Number
  businessStructure?: BusinessStructure;
  industryClassification?: string;
  businessAddress?: CustomerAddress;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;

  // Common fields
  externalId?: string;
  address?: CustomerAddress; // Residential address for individuals
  phone?: string;
  jurisdiction?: string;

  // Compliance status
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  isPep: boolean;
  isSanctioned: boolean;
  lastScreenedAt?: string;

  // Enhanced Due Diligence
  requiresEdd: boolean;
  eddCompletedAt?: string;
  eddNextReviewAt?: string;

  // Ongoing Customer Due Diligence
  ocddFrequencyDays: number;
  ocddLastReviewAt?: string;
  ocddNextReviewAt?: string;

  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCreateInput {
  email: string;
  customerType?: CustomerType;

  // Individual fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;

  // Business fields
  companyName?: string;
  tradingName?: string;
  companyRegistrationNumber?: string;
  abn?: string;
  acn?: string;
  businessStructure?: BusinessStructure;
  industryClassification?: string;
  businessAddress?: CustomerAddress;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;

  // Common fields
  externalId?: string;
  address?: CustomerAddress;
  phone?: string;
  jurisdiction?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerUpdateInput {
  email?: string;
  customerType?: CustomerType;

  // Individual fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;

  // Business fields
  companyName?: string;
  tradingName?: string;
  companyRegistrationNumber?: string;
  abn?: string;
  acn?: string;
  businessStructure?: BusinessStructure;
  industryClassification?: string;
  businessAddress?: CustomerAddress;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;

  // Common fields
  address?: CustomerAddress;
  phone?: string;
  jurisdiction?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  isPep?: boolean;
  requiresEdd?: boolean;
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
