import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createNotFoundError, createInternalError } from '@/lib/utils/errors';

function formatCustomer(customer: Record<string, unknown>) {
  return {
    id: `cus_${customer.id}`,
    object: 'customer',
    email: customer.email,
    firstName: customer.first_name,
    middleName: customer.middle_name,
    lastName: customer.last_name,
    dateOfBirth: customer.date_of_birth,
    externalId: customer.external_id,
    address: customer.residential_address,
    phone: customer.phone,
    verificationStatus: customer.verification_status,
    riskScore: customer.risk_score,
    riskLevel: customer.risk_level,
    isPep: customer.is_pep,
    isSanctioned: customer.is_sanctioned,
    lastScreenedAt: customer.last_screened_at,
    metadata: customer.metadata,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

function extractCustomerId(idParam: string): string {
  // Handle both cus_xxx format and raw UUID
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

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

      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .single();

      if (error || !customer) {
        return createNotFoundError('Customer');
      }

      return NextResponse.json(formatCustomer(customer));
    } catch (error) {
      console.error('Customer get error:', error);
      return createInternalError('Failed to get customer');
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const body = await req.json();
      const supabase = getServiceClient();

      const customerId = extractCustomerId(id);

      // Build update object
      const updates: Record<string, unknown> = {};
      if (body.email !== undefined) updates.email = body.email;
      if (body.firstName !== undefined) updates.first_name = body.firstName;
      if (body.middleName !== undefined) updates.middle_name = body.middleName;
      if (body.lastName !== undefined) updates.last_name = body.lastName;
      if (body.dateOfBirth !== undefined) updates.date_of_birth = body.dateOfBirth;
      if (body.address !== undefined) updates.residential_address = body.address;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.verificationStatus !== undefined) updates.verification_status = body.verificationStatus;
      if (body.isPep !== undefined) updates.is_pep = body.isPep;
      if (body.metadata !== undefined) updates.metadata = body.metadata;

      const { data: customer, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .select()
        .single();

      if (error || !customer) {
        return createNotFoundError('Customer');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'customer_updated',
        entity_type: 'customer',
        entity_id: customer.id,
        description: `Updated customer ${customer.email}`,
        metadata: { updatedFields: Object.keys(updates) },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(formatCustomer(customer));
    } catch (error) {
      console.error('Customer update error:', error);
      return createInternalError('Failed to update customer');
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const customerId = extractCustomerId(id);

      const { data: customer, error } = await supabase
        .from('customers')
        .delete()
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${id}`)
        .select('id')
        .single();

      if (error || !customer) {
        return createNotFoundError('Customer');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'customer_deleted',
        entity_type: 'customer',
        entity_id: customer.id,
        description: `Deleted customer`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        id: `cus_${customer.id}`,
        object: 'customer',
        deleted: true,
      });
    } catch (error) {
      console.error('Customer delete error:', error);
      return createInternalError('Failed to delete customer');
    }
  });
}
