export type VerificationStatus =
  | 'pending'
  | 'requires_input'
  | 'processing'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type VerificationProvider = 'stripe_identity' | 'manual';

export type DocumentType =
  | 'passport'
  | 'drivers_license'
  | 'birth_certificate'
  | 'citizenship_certificate'
  | 'medicare_card'
  | 'proof_of_age'
  | 'utility_bill'
  | 'bank_statement'
  | 'tax_return'
  | 'national_id'
  | 'other';

export type DocumentStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface VerifiedData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  address?: Address;
  documentType?: string;
  documentCountry?: string;
}

export interface CreateSessionOptions {
  returnUrl?: string;
  documentTypes?: DocumentType[];
  requireCertification?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionResult {
  verificationId: string;
  status: VerificationStatus;
  provider: VerificationProvider;
  clientSecret?: string;
  url?: string;
  expiresAt?: Date;
  requiredDocuments?: DocumentType[];
}

export interface VerificationResult {
  status: VerificationStatus;
  provider: VerificationProvider;
  verifiedData?: VerifiedData;
  rejectionReason?: string;
  rejectionDetails?: Record<string, unknown>;
  riskSignals?: Record<string, unknown>;
}

export interface IdentityVerification {
  id: string;
  tenantId: string;
  customerId: string;
  provider: VerificationProvider;
  stripeSessionId?: string;
  status: VerificationStatus;
  verifiedFirstName?: string;
  verifiedLastName?: string;
  verifiedDob?: string;
  verifiedAddress?: Address;
  documentType?: string;
  documentCountry?: string;
  rejectionReason?: string;
  rejectionDetails?: Record<string, unknown>;
  riskSignals?: Record<string, unknown>;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDocument {
  id: string;
  tenantId: string;
  customerId: string;
  verificationId?: string;
  documentType: DocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  documentNumber?: string;
  issuingCountry?: string;
  issueDate?: string;
  expiryDate?: string;
  isCertified: boolean;
  certification?: CertificationDetails;
  status: DocumentStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CertificationDetails {
  certifierName: string;
  certifierType: CertifierType;
  registrationNumber?: string;
  certificationDate: string;
  certificationStatement?: string;
}

export type CertifierType =
  | 'justice_of_peace'
  | 'lawyer'
  | 'solicitor'
  | 'barrister'
  | 'doctor'
  | 'dentist'
  | 'pharmacist'
  | 'veterinarian'
  | 'nurse'
  | 'optometrist'
  | 'chiropractor'
  | 'physiotherapist'
  | 'accountant'
  | 'teacher'
  | 'police_officer'
  | 'engineer'
  | 'bank_officer'
  | 'post_office_employee'
  | 'minister_of_religion';
