import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('UBO_API');

// GET /api/v1/business/[businessId]/owners
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { businessId } = await params;

      // Verify business belongs to this tenant
      const { data: business } = await supabase
        .from('business_customers')
        .select('id')
        .eq('id', businessId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (!business) {
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        );
      }

      // Fetch all beneficial owners for this business
      const { data: owners, error } = await supabase
        .from('beneficial_owners')
        .select('*')
        .eq('business_customer_id', businessId)
        .eq('tenant_id', tenant.tenantId)
        .order('ownership_percentage', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        object: 'list',
        data: owners || [],
      });
    } catch (error) {
      logger.error('[UBO_GET]', error);
      return NextResponse.json(
        { error: 'Failed to fetch beneficial owners' },
        { status: 500 }
      );
    }
  });
}

// POST /api/v1/business/[businessId]/owners
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { businessId } = await params;
      const body = await req.json();

      const {
        firstName,
        middleName,
        lastName,
        dateOfBirth,
        email,
        phone,
        residentialAddress,
        ownershipPercentage,
        ownershipType,
        role,
      } = body;

      // Validation
      if (!firstName || !lastName || !dateOfBirth || !ownershipPercentage || !ownershipType) {
        return NextResponse.json(
          { error: 'firstName, lastName, dateOfBirth, ownershipPercentage, and ownershipType are required' },
          { status: 400 }
        );
      }

      // Verify business belongs to this tenant
      const { data: business } = await supabase
        .from('business_customers')
        .select('id')
        .eq('id', businessId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (!business) {
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        );
      }

      // Check total ownership doesn't exceed 100%
      const { data: existingOwners } = await supabase
        .from('beneficial_owners')
        .select('ownership_percentage')
        .eq('business_customer_id', businessId)
        .eq('tenant_id', tenant.tenantId);

      const totalOwnership = (existingOwners || []).reduce(
        (sum, o) => sum + (o.ownership_percentage || 0),
        0
      );

      if (totalOwnership + ownershipPercentage > 100) {
        return NextResponse.json(
          { error: `Total ownership would exceed 100% (current: ${totalOwnership}%)` },
          { status: 400 }
        );
      }

      // Create beneficial owner
      const { data: owner, error } = await supabase
        .from('beneficial_owners')
        .insert({
          tenant_id: tenant.tenantId,
          business_customer_id: businessId,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          email,
          phone,
          residential_address: residentialAddress,
          ownership_percentage: ownershipPercentage,
          ownership_type: ownershipType,
          role,
          verification_status: 'unverified',
          verification_level: 'none',
          is_pep: false,
          is_sanctioned: false,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create UBO:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logger.info('UBO created:', owner.id);

      return NextResponse.json({
        object: 'beneficial_owner',
        ...owner,
      }, { status: 201 });
    } catch (error) {
      logger.error('[UBO_POST]', error);
      return NextResponse.json(
        { error: 'Failed to create beneficial owner' },
        { status: 500 }
      );
    }
  });
}
