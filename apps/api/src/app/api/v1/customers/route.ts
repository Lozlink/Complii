import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createValidationError, createInternalError } from '@/lib/utils/errors';

interface CustomerCreateBody {
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  externalId?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  phone?: string;
  metadata?: Record<string, unknown>;
}

function formatCustomer(customer: Record<string, unknown>) {
  return {
    id: `cus_${(customer.id as string).slice(0, 8)}`,
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

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body: CustomerCreateBody = await req.json();

      if (!body.email) {
        return createValidationError('email', 'email is required');
      }

      const { tenant } = req;
      const supabase = getServiceClient();

      const { data: customer, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenant.tenantId,
          email: body.email,
          first_name: body.firstName,
          middle_name: body.middleName,
          last_name: body.lastName,
          date_of_birth: body.dateOfBirth,
          external_id: body.externalId,
          residential_address: body.address,
          phone: body.phone,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Customer create error:', error);
        if (error.code === '23505') {
          return createValidationError('externalId', 'A customer with this external ID already exists');
        }
        return createInternalError('Failed to create customer');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'customer_created',
        entity_type: 'customer',
        entity_id: customer.id,
        description: `Created customer ${body.email}`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(formatCustomer(customer), { status: 201 });
    } catch (error) {
      console.error('Customer create error:', error);
      return createInternalError('Failed to create customer');
    }
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);

      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
      const startingAfter = searchParams.get('starting_after');
      const email = searchParams.get('email');
      const riskLevel = searchParams.get('risk_level');

      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (startingAfter) {
        query = query.lt('id', startingAfter);
      }

      if (email) {
        query = query.eq('email', email);
      }

      if (riskLevel) {
        query = query.eq('risk_level', riskLevel);
      }

      const { data: customers, error, count } = await query;

      if (error) {
        console.error('Customer list error:', error);
        return createInternalError('Failed to list customers');
      }

      const hasMore = customers && customers.length > limit;
      const data = (customers || []).slice(0, limit);

      return NextResponse.json({
        object: 'list',
        data: data.map(formatCustomer),
        hasMore,
        totalCount: count,
      });
    } catch (error) {
      console.error('Customer list error:', error);
      return createInternalError('Failed to list customers');
    }
  });
}
