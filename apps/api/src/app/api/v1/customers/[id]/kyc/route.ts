import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import {
  createValidationError,
  createInternalError,
  createNotFoundError,
} from '@/lib/utils/errors';
import {
  createProvider,
  VerificationProvider,
  DocumentType,
} from '@/lib/kyc';
import {
  dispatchKycVerificationStarted,
} from '@/lib/webhooks/dispatcher';

interface StartKycRequest {
  force: boolean;
  provider: VerificationProvider;
  returnUrl?: string;
  documentTypes?: DocumentType[];
  requireCertification?: boolean;
  metadata?: Record<string, unknown>;
}

function formatVerification(v: Record<string, unknown>) {
  return {
    id: `ver_${(v.id as string).slice(0, 8)}`,
    object: 'identity_verification',
    customerId: `cus_${(v.customer_id as string).slice(0, 8)}`,
    provider: v.provider,
    status: v.status,
    verifiedData: v.verified_first_name
      ? {
          firstName: v.verified_first_name,
          lastName: v.verified_last_name,
          dateOfBirth: v.verified_dob,
          address: v.verified_address,
          documentType: v.document_type,
          documentCountry: v.document_country,
        }
      : undefined,
    rejectionReason: v.rejection_reason,
    expiresAt: v.expires_at,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

// POST /v1/customers/:id/kyc - Start KYC verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const body: StartKycRequest = await req.json();
      const supabase = getServiceClient();

      // Validate provider
      if (!body.provider || !['stripe_identity', 'manual'].includes(body.provider)) {
        return createValidationError(
          'provider',
          "provider must be 'stripe_identity' or 'manual'"
        );
      }

      const customerId = extractCustomerId(id);

      // Verify customer exists
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, email, first_name, last_name')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .single();

      if (customerError || !customer) {
        return createNotFoundError('Customer');
      }

      // Check for existing pending verification
      if (body.force) {
        await supabase
          .from('identity_verifications')
          .update({ status: 'cancelled' })
          .eq('customer_id', customer.id)
          .in('status', ['pending', 'requires_input', 'processing']);
      } else {
        // Standard check for existing pending verification
        const {data: existingVerification} = await supabase
          .from('identity_verifications')
          .select('*')
          .eq('tenant_id', tenant.tenantId)
          .eq('customer_id', customer.id)
          .in('status', ['pending', 'requires_input', 'processing'])
          .order('created_at', {ascending: false})
          .limit(1)
          .maybeSingle();

        if (existingVerification) {
          // Return existing verification
          return NextResponse.json(formatVerification(existingVerification));
        }
      }

      // Create provider and start session
      const provider = createProvider(body.provider, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        settings: tenant.settings as Record<string, unknown>,
      });

      const sessionResult = await provider.createSession({
        returnUrl: body.returnUrl,
        documentTypes: body.documentTypes,
        requireCertification: body.requireCertification,
        metadata: body.metadata,
      });

      // Create verification record
      const { data: verification, error: insertError } = await supabase
        .from('identity_verifications')
        .insert({
          tenant_id: tenant.tenantId,
          customer_id: customer.id,
          provider: body.provider,
          stripe_session_id: body.provider === 'stripe_identity'
            ? sessionResult.verificationId
            : null,
          status: sessionResult.status,
          expires_at: sessionResult.expiresAt?.toISOString(),
          metadata: {
            returnUrl: body.returnUrl,
            documentTypes: body.documentTypes,
            requireCertification: body.requireCertification,
            ...body.metadata,
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create verification:', insertError);
        return createInternalError('Failed to start verification');
      }

      // Update customer status to pending
      await supabase
        .from('customers')
        .update({ verification_status: 'pending' })
        .eq('id', customer.id);

      // Dispatch webhook
      dispatchKycVerificationStarted(supabase, tenant.tenantId, {
        verificationId: `ver_${verification.id.slice(0, 8)}`,
        customerId: `cus_${customer.id.slice(0, 8)}`,
        provider: body.provider,
        status: sessionResult.status,
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'kyc_verification_started',
        entity_type: 'identity_verification',
        entity_id: verification.id,
        description: `Started ${body.provider} verification for customer ${customer.email}`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      // Return response with provider-specific data
      const response = {
        ...formatVerification(verification),
        clientSecret: sessionResult.clientSecret,
        url: sessionResult.url,
        requiredDocuments: sessionResult.requiredDocuments,
      };

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      console.error('KYC start error:', error);
      return createInternalError('Failed to start verification');
    }
  });
}

// GET /v1/customers/:id/kyc - Get KYC status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const customerId = extractCustomerId(id);

      // Verify customer exists
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .single();

      if (customerError || !customer) {
        return createNotFoundError('Customer');
      }

      // Get latest verification
      const { data: verification, error } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !verification) {
        return NextResponse.json({
          object: 'identity_verification_status',
          customerId: `cus_${customer.id.slice(0, 8)}`,
          status: 'none',
          verificationRequired: true,
        });
      }

      // If Stripe Identity, sync status from Stripe
      if (
        verification.provider === 'stripe_identity' &&
        verification.stripe_session_id &&
        ['pending', 'requires_input', 'processing'].includes(verification.status)
      ) {
        const provider = createProvider('stripe_identity', {
          tenantId: tenant.tenantId,
          customerId: customer.id,
        });

        try {
          const result = await provider.getVerification(verification.stripe_session_id);

          // Update if status changed
          if (result.status !== verification.status) {
            await supabase
              .from('identity_verifications')
              .update({
                status: result.status,
                verified_first_name: result.verifiedData?.firstName,
                verified_last_name: result.verifiedData?.lastName,
                verified_dob: result.verifiedData?.dateOfBirth,
                verified_address: result.verifiedData?.address,
                document_type: result.verifiedData?.documentType,
                rejection_reason: result.rejectionReason,
                rejection_details: result.rejectionDetails,
              })
              .eq('id', verification.id);
            if (result.status === 'verified') {
              await supabase
                .from('customers')
                .update({ verification_status: 'verified' })
                .eq('id', customer.id);
            } else if (result.status === 'rejected') {
              await supabase
                .from('customers')
                .update({ verification_status: 'rejected' })
                .eq('id', customer.id);
            }
            verification.status = result.status;
            verification.verified_first_name = result.verifiedData?.firstName;
            verification.verified_last_name = result.verifiedData?.lastName;
          }
        } catch (err) {
          console.error('Failed to sync Stripe status:', err);
        }
      }

      return NextResponse.json(formatVerification(verification));
    } catch (error) {
      console.error('KYC status error:', error);
      return createInternalError('Failed to get verification status');
    }
  });
}
