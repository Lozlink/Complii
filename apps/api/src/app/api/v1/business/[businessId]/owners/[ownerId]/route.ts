import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('UBO_DETAIL_API');

// GET /api/v1/business/[businessId]/owners/[ownerId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; ownerId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { businessId, ownerId } = await params;

      const { data: owner, error } = await supabase
        .from('beneficial_owners')
        .select('*')
        .eq('id', ownerId)
        .eq('business_customer_id', businessId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (error || !owner) {
        return NextResponse.json(
          { error: 'Beneficial owner not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        object: 'beneficial_owner',
        ...owner,
      });
    } catch (error) {
      logger.error('[UBO_GET_ID]', error);
      return NextResponse.json(
        { error: 'Failed to fetch beneficial owner' },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/v1/business/[businessId]/owners/[ownerId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; ownerId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { businessId, ownerId } = await params;
      const body = await req.json();

      const updateData: Record<string, unknown> = {};
      
      if (body.firstName !== undefined) updateData.first_name = body.firstName;
      if (body.middleName !== undefined) updateData.middle_name = body.middleName;
      if (body.lastName !== undefined) updateData.last_name = body.lastName;
      if (body.dateOfBirth !== undefined) updateData.date_of_birth = body.dateOfBirth;
      if (body.email !== undefined) updateData.email = body.email;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.residentialAddress !== undefined) updateData.residential_address = body.residentialAddress;
      if (body.ownershipPercentage !== undefined) updateData.ownership_percentage = body.ownershipPercentage;
      if (body.ownershipType !== undefined) updateData.ownership_type = body.ownershipType;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.verificationStatus !== undefined) updateData.verification_status = body.verificationStatus;
      if (body.verificationLevel !== undefined) updateData.verification_level = body.verificationLevel;
      if (body.identityVerificationId !== undefined) updateData.identity_verification_id = body.identityVerificationId;
      if (body.isPep !== undefined) updateData.is_pep = body.isPep;
      if (body.pepRelationship !== undefined) updateData.pep_relationship = body.pepRelationship;
      if (body.isSanctioned !== undefined) updateData.is_sanctioned = body.isSanctioned;

      // Update verification timestamps
      if (body.verificationStatus === 'verified') {
        updateData.last_verified_at = new Date().toISOString();
      }

      const { data: owner, error } = await supabase
        .from('beneficial_owners')
        .update(updateData)
        .eq('id', ownerId)
        .eq('business_customer_id', businessId)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!owner) {
        return NextResponse.json(
          { error: 'Beneficial owner not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        object: 'beneficial_owner',
        ...owner,
      });
    } catch (error) {
      logger.error('[UBO_PATCH]', error);
      return NextResponse.json(
        { error: 'Failed to update beneficial owner' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/v1/business/[businessId]/owners/[ownerId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; ownerId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { businessId, ownerId } = await params;

      const { error } = await supabase
        .from('beneficial_owners')
        .delete()
        .eq('id', ownerId)
        .eq('business_customer_id', businessId)
        .eq('tenant_id', tenant.tenantId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        deleted: true,
        id: ownerId,
      });
    } catch (error) {
      logger.error('[UBO_DELETE]', error);
      return NextResponse.json(
        { error: 'Failed to delete beneficial owner' },
        { status: 500 }
      );
    }
  });
}
