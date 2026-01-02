import { CustomerAddress } from './customers';

export type OwnershipType = 'direct' | 'indirect' | 'control';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface BeneficialOwner {
  id: string;
  object: 'beneficial_owner';
  customerId: string;

  // Identity
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  residentialAddress?: CustomerAddress;

  // Ownership Details
  ownershipPercentage: number;
  ownershipType: OwnershipType;
  controlDescription?: string;

  // Verification
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  verificationMethod?: string;
  verificationNotes?: string;

  // Risk Assessment
  isPep: boolean;
  pepDetails?: Record<string, unknown>;
  isSanctioned: boolean;
  sanctionedDetails?: Record<string, unknown>;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  lastScreenedAt?: string;

  // Document references
  identityDocumentIds?: string[];

  // Status
  isActive: boolean;
  ceasedDate?: string;

  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BeneficialOwnerCreateInput {
  customerId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  residentialAddress?: CustomerAddress;
  ownershipPercentage: number;
  ownershipType?: OwnershipType;
  controlDescription?: string;
  metadata?: Record<string, unknown>;
}

export interface BeneficialOwnerUpdateInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  residentialAddress?: CustomerAddress;
  ownershipPercentage?: number;
  ownershipType?: OwnershipType;
  controlDescription?: string;
  verificationStatus?: VerificationStatus;
  isActive?: boolean;
  ceasedDate?: string;
  metadata?: Record<string, unknown>;
}

export interface BeneficialOwnerListParams {
  customerId: string;
  isActive?: boolean;
  verificationStatus?: VerificationStatus;
  limit?: number;
  startingAfter?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface BeneficialOwnerListResponse {
  object: 'list';
  data: BeneficialOwner[];
  hasMore: boolean;
  totalCount: number;
}
