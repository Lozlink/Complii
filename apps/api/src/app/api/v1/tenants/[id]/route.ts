import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';

// GET /v1/tenants/:id - Get tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: tenant.id,
      object: 'tenant',
      name: tenant.name,
      email: tenant.email,
      region: tenant.region,
      plan: tenant.plan,
      status: tenant.status,
      settings: tenant.settings,
      monthlyScreeningLimit: tenant.monthly_screening_limit,
      monthlyScreeningsUsed: tenant.monthly_screenings_used,
      rateLimitPerMinute: tenant.rate_limit_per_minute,
      liveApiKeyPrefix: tenant.live_api_key_prefix,
      testApiKeyPrefix: tenant.test_api_key_prefix,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    });
  } catch (error) {
    console.error('Tenant get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /v1/tenants/:id - Update tenant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getServiceClient();

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.region !== undefined) updates.region = body.region;
    if (body.plan !== undefined) updates.plan = body.plan;
    if (body.status !== undefined) updates.status = body.status;
    if (body.settings !== undefined) updates.settings = body.settings;
    if (body.monthlyScreeningLimit !== undefined)
      updates.monthly_screening_limit = body.monthlyScreeningLimit;
    if (body.rateLimitPerMinute !== undefined)
      updates.rate_limit_per_minute = body.rateLimitPerMinute;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !tenant) {
      console.error('Failed to update tenant:', error);
      if (error?.code === '23505') {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: tenant.id,
      object: 'tenant',
      name: tenant.name,
      email: tenant.email,
      region: tenant.region,
      plan: tenant.plan,
      status: tenant.status,
      settings: tenant.settings,
      monthlyScreeningLimit: tenant.monthly_screening_limit,
      monthlyScreeningsUsed: tenant.monthly_screenings_used,
      rateLimitPerMinute: tenant.rate_limit_per_minute,
      liveApiKeyPrefix: tenant.live_api_key_prefix,
      testApiKeyPrefix: tenant.test_api_key_prefix,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    });
  } catch (error) {
    console.error('Tenant update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /v1/tenants/:id - Delete tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();

    // Check if tenant exists
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Delete tenant (cascade will delete related records)
    const { error } = await supabase.from('tenants').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete tenant:', error);
      return NextResponse.json(
        { error: 'Failed to delete tenant' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: id,
      object: 'tenant',
      deleted: true,
    });
  } catch (error) {
    console.error('Tenant delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
