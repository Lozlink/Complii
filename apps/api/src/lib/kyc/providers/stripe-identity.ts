import Stripe from 'stripe';
import { KycProvider, KycProviderConfig } from './base';
import type {
  VerificationProvider,
  VerificationStatus,
  CreateSessionOptions,
  CreateSessionResult,
  VerificationResult,
} from '../types';

export class StripeIdentityProvider extends KycProvider {
  readonly name: VerificationProvider = 'stripe_identity';
  private stripe: Stripe;

  constructor(config: KycProviderConfig) {
    super(config);
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-15.clover',
    });
  }

  async createSession(options: CreateSessionOptions): Promise<CreateSessionResult> {
    const session = await this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        tenant_id: this.config.tenantId,
        customer_id: this.config.customerId,
        ...options.metadata,
      },
      options: {
        document: {
          allowed_types: ['passport', 'driving_license', 'id_card'],
          require_matching_selfie: true,
          require_live_capture: true,
        },
      },
      return_url: options.returnUrl,
    });

    return {
      verificationId: session.id,
      status: this.mapStatus(session.status),
      provider: this.name,
      clientSecret: session.client_secret ?? undefined,
      url: session.url ?? undefined,
      expiresAt: undefined, // expires_at removed in newer Stripe API versions
    };
  }

  async getVerification(sessionId: string): Promise<VerificationResult> {
    const session = await this.stripe.identity.verificationSessions.retrieve(sessionId, {
      expand: ['verified_outputs', 'last_error'],
    });

    return {
      status: this.mapStatus(session.status),
      provider: this.name,
      verifiedData: session.verified_outputs
        ? {
            firstName: session.verified_outputs.first_name ?? undefined,
            lastName: session.verified_outputs.last_name ?? undefined,
            dateOfBirth: session.verified_outputs.dob
              ? `${session.verified_outputs.dob.year}-${String(session.verified_outputs.dob.month).padStart(2, '0')}-${String(session.verified_outputs.dob.day).padStart(2, '0')}`
              : undefined,
            address: session.verified_outputs.address
              ? {
                  line1: session.verified_outputs.address.line1 ?? undefined,
                  line2: session.verified_outputs.address.line2 ?? undefined,
                  city: session.verified_outputs.address.city ?? undefined,
                  state: session.verified_outputs.address.state ?? undefined,
                  postcode: session.verified_outputs.address.postal_code ?? undefined,
                  country: session.verified_outputs.address.country ?? undefined,
                }
              : undefined,
            documentType: session.verified_outputs.id_number_type ?? undefined,
          }
        : undefined,
      rejectionReason: session.last_error?.reason ?? undefined,
      rejectionDetails: session.last_error
        ? { code: session.last_error.code }
        : undefined,
    };
  }

  async cancelVerification(sessionId: string): Promise<void> {
    await this.stripe.identity.verificationSessions.cancel(sessionId);
  }

  private mapStatus(stripeStatus: string): VerificationStatus {
    const statusMap: Record<string, VerificationStatus> = {
      requires_input: 'requires_input',
      processing: 'processing',
      verified: 'verified',
      canceled: 'cancelled',
    };
    return statusMap[stripeStatus] || 'pending';
  }
}
