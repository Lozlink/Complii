import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/client';
import { createAuditLog } from '@/lib/utils/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/beneficial-owners/:id - Get beneficial owner
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant } = authResult;
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('beneficial_owners')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Beneficial owner not found' }, { status: 404 });
  }

  return NextResponse.json(transformBeneficialOwner(data));
}

// PATCH /api/v1/beneficial-owners/:id - Update beneficial owner
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant, apiKeyPrefix } = authResult;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  const fieldMappings: Record<string, string> = {
    firstName: 'first_name',
    middleName: 'middle_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    nationality: 'nationality',
    email: 'email',
    phone: 'phone',
    residentialAddress: 'residential_address',
    ownershipPercentage: 'ownership_percentage',
    ownershipType: 'ownership_type',
    controlDescription: 'control_description',
    verificationStatus: 'verification_status',
    isActive: 'is_active',
    ceasedDate: 'ceased_date',
    metadata: 'metadata',
  };

  for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
    if (body[camelKey] !== undefined) {
      updateData[snakeKey] = body[camelKey];
    }
  }

  if (updateData.ownership_percentage !== undefined) {
    const pct = updateData.ownership_percentage as number;
    if (pct <= 0 || pct > 100) {
      return NextResponse.json(
        { error: 'ownershipPercentage must be between 0 and 100' },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('beneficial_owners')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Beneficial owner not found' }, { status: 404 });
  }

  await createAuditLog(supabaseAdmin, {
    tenantId: tenant.id,
    actionType: 'beneficial_owner.updated',
    entityType: 'beneficial_owner',
    entityId: id,
    description: `Updated beneficial owner ${data.first_name} ${data.last_name}`,
    metadata: { updatedFields: Object.keys(updateData) },
    apiKeyPrefix,
    request,
  });

  return NextResponse.json(transformBeneficialOwner(data));
}

// DELETE /api/v1/beneficial-owners/:id - Delete beneficial owner
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant, apiKeyPrefix } = authResult;
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('beneficial_owners')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Beneficial owner not found' }, { status: 404 });
  }

  await createAuditLog(supabaseAdmin, {
    tenantId: tenant.id,
    actionType: 'beneficial_owner.deleted',
    entityType: 'beneficial_owner',
    entityId: id,
    description: `Deleted beneficial owner ${data.first_name} ${data.last_name}`,
    apiKeyPrefix,
    request,
  });

  return NextResponse.json({ deleted: true, id });
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
