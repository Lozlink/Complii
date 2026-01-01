import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createInternalError } from '@/lib/utils/errors';

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
    expiresAt: v.expires_at,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

// GET /v1/identity-verifications - List all verifications
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);

      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const startingAfter = searchParams.get('starting_after');
      const customerId = searchParams.get('customer_id');
      const status = searchParams.get('status');
      const provider = searchParams.get('provider');

      let query = supabase
        .from('identity_verifications')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (startingAfter) {
        const afterId = startingAfter.startsWith('ver_')
          ? startingAfter.slice(4)
          : startingAfter;
        query = query.lt('id', afterId);
      }

      if (customerId) {
        const cusId = customerId.startsWith('cus_')
          ? customerId.slice(4)
          : customerId;
        query = query.ilike('customer_id', `${cusId}%`);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (provider) {
        query = query.eq('provider', provider);
      }

      const { data: verifications, error, count } = await query;

      if (error) {
        console.error('Verification list error:', error);
        return createInternalError('Failed to list verifications');
      }

      const hasMore = verifications && verifications.length > limit;
      const data = (verifications || []).slice(0, limit);

      return NextResponse.json({
        object: 'list',
        data: data.map(formatVerification),
        hasMore,
        totalCount: count,
      });
    } catch (error) {
      console.error('Verification list error:', error);
      return createInternalError('Failed to list verifications');
    }
  });
}
