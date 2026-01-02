import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/client';
import { createAuditLog } from '@/lib/utils/audit';

// GET /api/v1/beneficial-owners - List beneficial owners
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant, apiKeyPrefix } = authResult;
  const { searchParams } = new URL(request.url);

  const customerId = searchParams.get('customer_id');
  const isActive = searchParams.get('is_active');
  const verificationStatus = searchParams.get('verification_status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const startingAfter = searchParams.get('starting_after');

  let query = supabaseAdmin
    .from('beneficial_owners')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
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
}

// POST /api/v1/beneficial-owners - Create beneficial owner
export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant, apiKeyPrefix } = authResult;

  let body;
  try {
    body = await request.json();
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
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, customer_type')
    .eq('id', customerId)
    .eq('tenant_id', tenant.id)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Insert beneficial owner
  const { data, error } = await supabaseAdmin
    .from('beneficial_owners')
    .insert({
      tenant_id: tenant.id,
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

  await createAuditLog(supabaseAdmin, {
    tenantId: tenant.id,
    actionType: 'beneficial_owner.created',
    entityType: 'beneficial_owner',
    entityId: data.id,
    description: `Created beneficial owner ${firstName} ${lastName} for customer ${customerId}`,
    apiKeyPrefix,
    request,
  });

  return NextResponse.json(transformBeneficialOwner(data), { status: 201 });
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
