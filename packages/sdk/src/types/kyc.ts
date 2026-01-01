import type { CustomerAddress } from './customers';

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

export interface CertificationDetails {
  certifierName: string;
  certifierType: CertifierType;
  registrationNumber?: string;
  certificationDate: string;
  certificationStatement?: string;
}

export interface VerifiedData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  address?: CustomerAddress;
  documentType?: string;
  documentCountry?: string;
}

export interface IdentityVerification {
  id: string;
  object: 'identity_verification';
  customerId: string;
  provider: VerificationProvider;
  status: VerificationStatus;
  clientSecret?: string;
  url?: string;
  verifiedData?: VerifiedData;
  rejectionReason?: string;
  requiredDocuments?: DocumentType[];
  expiresAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDocument {
  id: string;
  object: 'customer_document';
  customerId: string;
  verificationId?: string;
  documentType: DocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentNumber?: string;
  issuingCountry?: string;
  issueDate?: string;
  expiryDate?: string;
  isCertified: boolean;
  certification?: CertificationDetails;
  status: DocumentStatus;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartKycInput {
  provider: VerificationProvider;
  returnUrl?: string;
  documentTypes?: DocumentType[];
  requireCertification?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UploadDocumentInput {
  file: File | Blob;
  documentType: DocumentType;
  isCertified?: boolean;
  certification?: CertificationDetails;
  verificationId?: string;
  documentNumber?: string;
  issuingCountry?: string;
  issueDate?: string;
  expiryDate?: string;
}

export interface ReviewVerificationInput {
  decision: 'approve' | 'reject';
  reason?: string;
  notes?: string;
}

export interface VerificationListParams {
  customerId?: string;
  status?: VerificationStatus;
  provider?: VerificationProvider;
  limit?: number;
  startingAfter?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface DocumentListParams {
  status?: DocumentStatus;
  verificationId?: string;
  limit?: number;
  startingAfter?: string;
  [key: string]: string | number | boolean | undefined;
}
