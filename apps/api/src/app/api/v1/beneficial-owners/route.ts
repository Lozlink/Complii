import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /api/v1/beneficial-owners - List beneficial owners
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const customerId = searchParams.get('customer_id');
      const isActive = searchParams.get('is_active');
      const verificationStatus = searchParams.get('verification_status');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const startingAfter = searchParams.get('starting_after');

      let query = supabase
        .from('beneficial_owners')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      if (isActive !== null) {
        query = query.eq('is_active', isActive === 'true');
      }
      if (verificationStatus) {
        query = query.eq('verification_status', verificationStatus);
      }
      if (startingAfter) {
        query = query.lt('id', startingAfter);
      }

      const { data, error, count } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const transformedData = data?.map(transformBeneficialOwner) || [];

      return NextResponse.json({
        object: 'list',
        data: transformedData,
        hasMore: (count || 0) > limit,
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('Error fetching beneficial owners:', error);
      return NextResponse.json({ error: 'Failed to list beneficial owners' }, { status: 500 });
    }
  });
}

// POST /api/v1/beneficial-owners - Create beneficial owner
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();

      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const {
        customerId,
        firstName,
        middleName,
        lastName,
        dateOfBirth,
        nationality,
        email,
        phone,
        residentialAddress,
        ownershipPercentage,
        ownershipType = 'direct',
        controlDescription,
        metadata,
      } = body;

      // Validate required fields
      if (!customerId || !firstName || !lastName || ownershipPercentage === undefined) {
        return NextResponse.json(
          { error: 'customerId, firstName, lastName, and ownershipPercentage are required' },
          { status: 400 }
        );
      }

      if (ownershipPercentage <= 0 || ownershipPercentage > 100) {
        return NextResponse.json(
          { error: 'ownershipPercentage must be between 0 and 100' },
          { status: 400 }
        );
      }

      // Verify customer belongs to tenant
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, customer_type')
        .eq('id', customerId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (customerError || !customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      // Insert beneficial owner
      const { data, error } = await supabase
        .from('beneficial_owners')
        .insert({
          tenant_id: tenant.tenantId,
          customer_id: customerId,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          nationality,
          email,
          phone,
          residential_address: residentialAddress,
          ownership_percentage: ownershipPercentage,
          ownership_type: ownershipType,
          control_description: controlDescription,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'beneficial_owner.created',
        entity_type: 'beneficial_owner',
        entity_id: data.id,
        description: `Created beneficial owner ${firstName} ${lastName} for customer ${customerId}`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(transformBeneficialOwner(data), { status: 201 });
    } catch (error) {
      console.error('Beneficial owner create error:', error);
      return NextResponse.json({ error: 'Failed to create beneficial owner' }, { status: 500 });
    }
  });
}

function transformBeneficialOwner(row: Record<string, unknown>) {
  return {
    id: row.id,
    object: 'beneficial_owner',
    customerId: row.customer_id,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    email: row.email,
    phone: row.phone,
    residentialAddress: row.residential_address,
    ownershipPercentage: row.ownership_percentage,
    ownershipType: row.ownership_type,
    controlDescription: row.control_description,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    verificationMethod: row.verification_method,
    verificationNotes: row.verification_notes,
    isPep: row.is_pep,
    pepDetails: row.pep_details,
    isSanctioned: row.is_sanctioned,
    sanctionedDetails: row.sanctioned_details,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    lastScreenedAt: row.last_screened_at,
    identityDocumentIds: row.identity_document_ids,
    isActive: row.is_active,
    ceasedDate: row.ceased_date,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
