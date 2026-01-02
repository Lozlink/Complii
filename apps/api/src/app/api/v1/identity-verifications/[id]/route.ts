import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createInternalError, createNotFoundError } from '@/lib/utils/errors';
import { createProvider } from '@/lib/kyc';

function formatVerification(v: Record<string, unknown>) {
  return {
    id: `ver_${v.id}`,
    object: 'identity_verification',
    customerId: `cus_${v.customer_id as string}`,
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
    rejectionDetails: v.rejection_details,
    riskSignals: v.risk_signals,
    reviewedAt: v.reviewed_at,
    reviewNotes: v.review_notes,
    expiresAt: v.expires_at,
    metadata: v.metadata,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

function extractVerificationId(idParam: string): string {
  return idParam.startsWith('ver_') ? idParam.slice(4) : idParam;

}

// GET /v1/identity-verifications/:id - Get verification details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const verificationId = extractVerificationId(id);

      // Get verification
      const { data: verification, error } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .ilike('id', `${verificationId}%`)
        .single();

      if (error || !verification) {
        return createNotFoundError('Identity verification');
      }

      // If Stripe Identity and in progress, sync status
      if (
        verification.provider === 'stripe_identity' &&
        verification.stripe_session_id &&
        ['pending', 'requires_input', 'processing'].includes(verification.status)
      ) {
        const provider = createProvider('stripe_identity', {
          tenantId: tenant.tenantId,
          customerId: verification.customer_id,
        });

        try {
          const result = await provider.getVerification(verification.stripe_session_id);

          if (result.status !== verification.status) {
            const updates: Record<string, unknown> = {
              status: result.status,
            };

            if (result.verifiedData) {
              updates.verified_first_name = result.verifiedData.firstName;
              updates.verified_last_name = result.verifiedData.lastName;
              updates.verified_dob = result.verifiedData.dateOfBirth;
              updates.verified_address = result.verifiedData.address;
              updates.document_type = result.verifiedData.documentType;
            }

            if (result.rejectionReason) {
              updates.rejection_reason = result.rejectionReason;
              updates.rejection_details = result.rejectionDetails;
            }

            await supabase
              .from('identity_verifications')
              .update(updates)
              .eq('id', verification.id);

            // Merge updates into response
            Object.assign(verification, updates);
          }
        } catch (err) {
          console.error('Failed to sync Stripe status:', err);
        }
      }

      return NextResponse.json(formatVerification(verification));
    } catch (error) {
      console.error('Verification get error:', error);
      return createInternalError('Failed to get verification');
    }
  });
}
