import { CustomerAddress } from './customers';

export type EntityType = 'company' | 'sole_trader' | 'partnership' | 'trust' | 'smsf';

export type BusinessOwnershipType = 'direct' | 'indirect' | 'control_person';

export type AuthorizationType = 'director' | 'secretary' | 'authorized_signatory' | 'delegate';

export type BusinessVerificationStatus = 'pending' | 'verified' | 'rejected' | 'requires_review';

export type MonitoringLevel = 'standard' | 'ongoing_review' | 'enhanced' | 'blocked';

export type EDDStatus = 'pending' | 'under_review' | 'escalated' | 'approved' | 'rejected';

export interface ABRResponse {
  abn: string;
  abnStatus: 'Active' | 'Cancelled' | 'Deleted';
  abnStatusFromDate: string;
  entityName: string;
  entityType: string;
  entityTypeCode: string;
  gstRegistered: boolean;
  gstRegisteredDate?: string;
  acn?: string;
  mainBusinessLocation: {
    state: string;
    postcode: string;
  };
  businessNames?: Array<{
    name: string;
    effectiveFrom: string;
  }>;
}

export interface BusinessCustomer {
  id: string;
  object: 'business_customer';
  primaryContactCustomerId: string;
  abn: string;
  acn?: string;
  businessName: string;
  tradingName?: string;
  entityType: EntityType;
  businessStructureDetails?: Record<string, unknown>;
  abrVerified: boolean;
  abrVerifiedAt?: string;
  abrResponse?: ABRResponse;
  gstRegistered: boolean;
  gstRegisteredDate?: string;
  entityStatus: string;
  mainBusinessLocation?: {
    state: string;
    postcode: string;
  };
  registeredAddress?: CustomerAddress;
  principalAddress?: CustomerAddress;
  industryCode?: string;
  industryDescription?: string;
  verificationStatus: BusinessVerificationStatus;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  uboVerificationComplete: boolean;
  uboVerificationDate?: string;
  requiresEnhancedDd: boolean;
  eddCompleted: boolean;
  eddCompletedAt?: string;
  currentInvestigationId?: string;
  monitoringLevel: MonitoringLevel;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessBeneficialOwner {
  id: string;
  object: 'business_beneficial_owner';
  businessCustomerId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  residentialAddress?: CustomerAddress;
  ownershipPercentage: number;
  ownershipType: BusinessOwnershipType;
  role?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationLevel: 'none' | 'manual' | 'stripe_identity' | 'dvs_verified';
  identityVerificationId?: string;
  isPep: boolean;
  pepRelationship?: string;
  isSanctioned: boolean;
  lastScreeningAt?: string;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAuthorizedPerson {
  id: string;
  object: 'business_authorized_person';
  businessCustomerId: string;
  customerId: string;
  authorizationType: AuthorizationType;
  authorizationDocumentId?: string;
  transactionLimitAud?: number;
  requiresCoSignatory: boolean;
  isActive: boolean;
  authorizedAt: string;
  authorizedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessEDD {
  id: string;
  object: 'business_edd';
  businessCustomerId: string;
  primaryBusinessActivity: string;
  yearsInOperation?: number;
  annualTurnoverRange: string;
  primarySourceOfFunds: string;
  sourceOfFundsDetails?: string;
  expectedTransactionFrequency: string;
  expectedAnnualVolume: string;
  primaryPurpose?: string;
  keySuppliers?: Record<string, unknown>;
  keyCustomers?: Record<string, unknown>;
  primaryBank?: string;
  bankingHistoryYears?: number;
  status: EDDStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  requiresManagementApproval: boolean;
  escalatedToManagementAt?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface BusinessCustomerCreateInput {
  primaryContactCustomerId: string;
  entityType: EntityType;
  abn: string;
  acn?: string;
  businessName: string;
  tradingName?: string;
  abrResponse?: ABRResponse;
  registeredAddress?: CustomerAddress;
  principalAddress?: CustomerAddress;
  industryCode?: string;
  industryDescription?: string;
}

export interface BusinessCustomerUpdateInput {
  businessName?: string;
  tradingName?: string;
  principalAddress?: CustomerAddress;
  industryCode?: string;
  industryDescription?: string;
  verificationStatus?: BusinessVerificationStatus;
  verificationNotes?: string;
  uboVerificationComplete?: boolean;
  requiresEnhancedDd?: boolean;
  eddCompleted?: boolean;
  monitoringLevel?: MonitoringLevel;
}

export interface BusinessBeneficialOwnerCreateInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  residentialAddress?: CustomerAddress;
  ownershipPercentage: number;
  ownershipType: BusinessOwnershipType;
  role?: string;
}

export interface BusinessBeneficialOwnerUpdateInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  residentialAddress?: CustomerAddress;
  ownershipPercentage?: number;
  ownershipType?: BusinessOwnershipType;
  role?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationLevel?: 'none' | 'manual' | 'stripe_identity' | 'dvs_verified';
  identityVerificationId?: string;
  isPep?: boolean;
  pepRelationship?: string;
  isSanctioned?: boolean;
}

export interface BusinessCustomerListResponse {
  object: 'list';
  data: BusinessCustomer[];
  hasMore: boolean;
  totalCount: number;
}

export interface BusinessBeneficialOwnerListResponse {
  object: 'list';
  data: BusinessBeneficialOwner[];
}

export interface BusinessRiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high';
  blocked: boolean;
  blockReason?: string;
  requiresEdd: boolean;
}
