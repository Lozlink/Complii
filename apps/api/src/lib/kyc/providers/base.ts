import type {
  VerificationProvider,
  CreateSessionOptions,
  CreateSessionResult,
  VerificationResult,
} from '../types';

export interface KycProviderConfig {
  tenantId: string;
  customerId: string;
  settings?: Record<string, unknown>;
}

export abstract class KycProvider {
  abstract readonly name: VerificationProvider;

  constructor(protected config: KycProviderConfig) {}

  abstract createSession(options: CreateSessionOptions): Promise<CreateSessionResult>;
  abstract getVerification(verificationId: string): Promise<VerificationResult>;
  abstract cancelVerification(verificationId: string): Promise<void>;
}

export function createProvider(
  provider: VerificationProvider,
  config: KycProviderConfig
): KycProvider {
  switch (provider) {
    case 'stripe_identity':
      // Lazy import to avoid loading Stripe when not needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { StripeIdentityProvider } = require('./stripe-identity');
      return new StripeIdentityProvider(config);
    case 'manual':
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ManualVerificationProvider } = require('./manual');
      return new ManualVerificationProvider(config);
    default:
      throw new Error(`Unknown KYC provider: ${provider}`);
  }
}
