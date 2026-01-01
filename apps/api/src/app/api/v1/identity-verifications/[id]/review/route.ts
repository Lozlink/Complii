import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import {
  createValidationError,
  createInternalError,
  createNotFoundError,
} from '@/lib/utils/errors';
import {
  triggerPostVerificationActions,
  updateCustomerVerificationStatus,
} from '@/lib/kyc';
import { dispatchKycStatusChanged, dispatchDocumentReviewed } from '@/lib/webhooks/dispatcher';

interface ReviewRequest {
  decision: 'approve' | 'reject';
  reason?: string;
  notes?: string;
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
    reviewedAt: v.reviewed_at,
    reviewNotes: v.review_notes,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

function extractVerificationId(idParam: string): string {
  if (idParam.startsWith('ver_')) {
    return idParam.slice(4);
  }
  return idParam;
}

// POST /v1/identity-verifications/:id/review - Admin review verification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const body: ReviewRequest = await req.json();
      const supabase = getServiceClient();

      // Validate request
      if (!body.decision || !['approve', 'reject'].includes(body.decision)) {
        return createValidationError(
          'decision',
          "Decision must be 'approve' or 'reject'"
        );
      }

      if (body.decision === 'reject' && !body.reason) {
        return createValidationError(
          'reason',
          'Reason is required when rejecting'
        );
      }

      const verificationId = extractVerificationId(id);

      // Get verification
      const { data: verification, error: fetchError } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .ilike('id', `${verificationId}%`)
        .single();

      if (fetchError || !verification) {
        return createNotFoundError('Identity verification');
      }

      // Only manual verifications can be reviewed this way
      if (verification.provider !== 'manual') {
        return createValidationError(
          'provider',
          'Only manual verifications can be reviewed via this endpoint'
        );
      }

      // Check if verification is in reviewable state
      if (!['pending', 'processing'].includes(verification.status)) {
        return createValidationError(
          'status',
          'Verification is not in a reviewable state'
        );
      }

      const newStatus = body.decision === 'approve' ? 'verified' : 'rejected';
      const now = new Date().toISOString();

      // Update verification
      const { error: updateError } = await supabase
        .from('identity_verifications')
        .update({
          status: newStatus,
          rejection_reason: body.decision === 'reject' ? body.reason : null,
          reviewed_at: now,
          review_notes: body.notes,
        })
        .eq('id', verification.id);

      if (updateError) {
        console.error('Failed to update verification:', updateError);
        return createInternalError('Failed to update verification');
      }

      // Update customer verification status
      const customerStatus = body.decision === 'approve' ? 'verified' : 'rejected';
      await updateCustomerVerificationStatus(
        supabase,
        verification.customer_id,
        customerStatus
      );

      // Update all associated documents
      const { data: updatedDocs } = await supabase
        .from('customer_documents')
        .update({
          status: body.decision === 'approve' ? 'approved' : 'rejected',
          rejection_reason: body.decision === 'reject' ? body.reason : null,
          reviewed_at: now,
          review_notes: body.notes,
        })
        .eq('verification_id', verification.id)
        .select('id');

      // Trigger post-verification actions if approved
      if (body.decision === 'approve') {
        await triggerPostVerificationActions(
          supabase,
          tenant.tenantId,
          verification.customer_id
        );
      }

      // Dispatch webhooks
      await dispatchKycStatusChanged(supabase, tenant.tenantId, {
        verificationId: `ver_${verification.id.slice(0, 8)}`,
        customerId: `cus_${verification.customer_id.slice(0, 8)}`,
        status: newStatus,
        previousStatus: verification.status,
        provider: verification.provider,
        decision: body.decision,
        reason: body.reason,
      });

      // Dispatch document reviewed webhook for each document
      if (updatedDocs) {
        for (const doc of updatedDocs) {
          await dispatchDocumentReviewed(supabase, tenant.tenantId, {
            documentId: `doc_${doc.id.slice(0, 8)}`,
            customerId: `cus_${verification.customer_id.slice(0, 8)}`,
            verificationId: `ver_${verification.id.slice(0, 8)}`,
            decision: body.decision,
            reason: body.reason,
          });
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: `verification_${body.decision}d`,
        entity_type: 'identity_verification',
        entity_id: verification.id,
        description: `${body.decision === 'approve' ? 'Approved' : 'Rejected'} manual verification`,
        metadata: {
          decision: body.decision,
          reason: body.reason,
          documentsUpdated: updatedDocs?.length || 0,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      // Get updated verification
      const { data: updated } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('id', verification.id)
        .single();

      return NextResponse.json(formatVerification(updated || verification));
    } catch (error) {
      console.error('Review error:', error);
      return createInternalError('Failed to process review');
    }
  });
}
