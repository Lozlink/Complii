import { KycProvider, KycProviderConfig } from './base';
import type {
  VerificationProvider,
  CreateSessionOptions,
  CreateSessionResult,
  VerificationResult,
  DocumentType,
} from '../types';

const DEFAULT_REQUIRED_DOCUMENTS: DocumentType[] = ['passport'];

export class ManualVerificationProvider extends KycProvider {
  readonly name: VerificationProvider = 'manual';

  constructor(config: KycProviderConfig) {
    super(config);
  }

  async createSession(options: CreateSessionOptions): Promise<CreateSessionResult> {
    // For manual verification, we just return the requirements
    // The actual verification record is created by the API endpoint
    const requiredDocuments = options.documentTypes || DEFAULT_REQUIRED_DOCUMENTS;

    return {
      verificationId: '', // Will be set by the API after DB insert
      status: 'pending',
      provider: this.name,
      requiredDocuments,
    };
  }

  async getVerification(_verificationId: string): Promise<VerificationResult> {
    // Manual verification status is managed directly in the database
    // This method is primarily used for provider-managed verifications
    return {
      status: 'pending',
      provider: this.name,
    };
  }

  async cancelVerification(_verificationId: string): Promise<void> {
    // No external provider to notify for manual verification
    // Status update is handled directly in the database
  }
}
