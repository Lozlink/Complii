/**
 * Business customer types for AUSTRAC compliance
 */

export type EntityType = 'company' | 'sole_trader' | 'partnership' | 'trust' | 'smsf';

export type OwnershipType = 'direct' | 'indirect' | 'control_person';

export type AuthorizationType = 'director' | 'secretary' | 'authorized_signatory' | 'delegate';

export interface BeneficialOwner {
  id: string;
  businessCustomerId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  residentialAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  ownershipPercentage: number;
  ownershipType: OwnershipType;
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

export interface BusinessCustomer {
  id: string;
  primaryContactCustomerId: string;
  abn: string;
  acn?: string;
  businessName: string;
  tradingName?: string;
  entityType: EntityType;
  businessStructureDetails?: Record<string, unknown>;
  abrVerified: boolean;
  abrVerifiedAt?: string;
  abrResponse?: Record<string, unknown>;
  gstRegistered: boolean;
  gstRegisteredDate?: string;
  entityStatus: string;
  mainBusinessLocation?: {
    state: string;
    postcode: string;
  };
  registeredAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  principalAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  industryCode?: string;
  industryDescription?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'requires_review';
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
  monitoringLevel: 'standard' | 'ongoing_review' | 'enhanced' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

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

export interface ABRLookupResult {
  success: boolean;
  data?: ABRResponse;
  error?: string;
}

export interface BusinessAuthorizedPerson {
  id: string;
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
  status: 'pending' | 'under_review' | 'escalated' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  requiresManagementApproval: boolean;
  escalatedToManagementAt?: string;
  submittedAt: string;
  updatedAt: string;
}
