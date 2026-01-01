import type { HttpClient } from '../utils/http';
import type {
  IdentityVerification,
  CustomerDocument,
  StartKycInput,
  UploadDocumentInput,
  ReviewVerificationInput,
  VerificationListParams,
  DocumentListParams,
} from '../types/kyc';

interface ListResponse<T> {
  object: 'list';
  data: T[];
  hasMore: boolean;
  totalCount: number;
}

export class KycResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Start a KYC verification session for a customer
   * @param customerId - The customer ID (cus_xxx format or raw UUID)
   * @param input - Verification options including provider and settings
   * @returns The created verification with provider-specific data (clientSecret, url for Stripe)
   */
  async startVerification(
    customerId: string,
    input: StartKycInput
  ): Promise<IdentityVerification> {
    return this.http.post<IdentityVerification>(
      `/customers/${customerId}/kyc`,
      input
    );
  }

  /**
   * Get the current KYC verification status for a customer
   * @param customerId - The customer ID
   * @returns The latest verification or status object if none exists
   */
  async getStatus(customerId: string): Promise<IdentityVerification> {
    return this.http.get<IdentityVerification>(`/customers/${customerId}/kyc`);
  }

  /**
   * List all identity verifications for the tenant
   * @param params - Optional filtering parameters
   */
  async listVerifications(
    params?: VerificationListParams
  ): Promise<ListResponse<IdentityVerification>> {
    return this.http.get<ListResponse<IdentityVerification>>(
      '/identity-verifications',
      params
    );
  }

  /**
   * Retrieve a specific identity verification by ID
   * @param verificationId - The verification ID (ver_xxx format or raw UUID)
   */
  async retrieveVerification(verificationId: string): Promise<IdentityVerification> {
    return this.http.get<IdentityVerification>(
      `/identity-verifications/${verificationId}`
    );
  }

  /**
   * Upload a document for manual KYC verification
   * @param customerId - The customer ID
   * @param input - Document upload details including file and certification
   */
  async uploadDocument(
    customerId: string,
    input: UploadDocumentInput
  ): Promise<CustomerDocument> {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('documentType', input.documentType);
    formData.append('isCertified', String(input.isCertified ?? false));

    if (input.certification) {
      formData.append('certification', JSON.stringify(input.certification));
    }
    if (input.verificationId) {
      formData.append('verificationId', input.verificationId);
    }
    if (input.documentNumber) {
      formData.append('documentNumber', input.documentNumber);
    }
    if (input.issuingCountry) {
      formData.append('issuingCountry', input.issuingCountry);
    }
    if (input.issueDate) {
      formData.append('issueDate', input.issueDate);
    }
    if (input.expiryDate) {
      formData.append('expiryDate', input.expiryDate);
    }

    return this.http.postFormData<CustomerDocument>(
      `/customers/${customerId}/kyc/documents`,
      formData
    );
  }

  /**
   * List documents for a customer
   * @param customerId - The customer ID
   * @param params - Optional filtering parameters
   */
  async listDocuments(
    customerId: string,
    params?: DocumentListParams
  ): Promise<ListResponse<CustomerDocument>> {
    return this.http.get<ListResponse<CustomerDocument>>(
      `/customers/${customerId}/kyc/documents`,
      params
    );
  }

  /**
   * Retrieve a specific document
   * @param customerId - The customer ID
   * @param documentId - The document ID (doc_xxx format or raw UUID)
   */
  async retrieveDocument(
    customerId: string,
    documentId: string
  ): Promise<CustomerDocument> {
    return this.http.get<CustomerDocument>(
      `/customers/${customerId}/kyc/documents/${documentId}`
    );
  }

  /**
   * Delete a document (only pending or rejected documents can be deleted)
   * @param customerId - The customer ID
   * @param documentId - The document ID
   */
  async deleteDocument(
    customerId: string,
    documentId: string
  ): Promise<{ id: string; object: 'customer_document'; deleted: boolean }> {
    return this.http.delete(
      `/customers/${customerId}/kyc/documents/${documentId}`
    );
  }

  /**
   * Review a manual verification (approve or reject)
   * @param verificationId - The verification ID
   * @param input - Review decision and optional reason/notes
   */
  async reviewVerification(
    verificationId: string,
    input: ReviewVerificationInput
  ): Promise<IdentityVerification> {
    return this.http.post<IdentityVerification>(
      `/identity-verifications/${verificationId}/review`,
      input
    );
  }
}
