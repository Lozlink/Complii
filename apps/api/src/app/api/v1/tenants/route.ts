import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import bcrypt from 'bcryptjs';

function generateApiKey(prefix: string): string {
  const randomPart = Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');
  return `${prefix}_${randomPart}`;
}

// POST /v1/tenants - Create tenant (admin only - no auth for simplicity)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getServiceClient();

    // Validate required fields
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Generate API keys
    const liveApiKey = generateApiKey('sk_live');
    const testApiKey = generateApiKey('sk_test');

    // Hash API keys
    const liveApiKeyHash = await bcrypt.hash(liveApiKey, 10);
    const testApiKeyHash = await bcrypt.hash(testApiKey, 10);

    // Create tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name: body.name,
        email: body.email,
        region: body.region || 'AU',
        plan: body.plan || 'starter',
        monthly_screening_limit: body.monthlyScreeningLimit || 1000,
        rate_limit_per_minute: body.rateLimitPerMinute || 60,
        live_api_key_hash: liveApiKeyHash,
        test_api_key_hash: testApiKeyHash,
        live_api_key_prefix: liveApiKey.slice(0, 15),
        test_api_key_prefix: testApiKey.slice(0, 15),
        settings: body.settings || {},
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create tenant:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create tenant' },
        { status: 500 }
      );
    }

    // Return tenant with API keys (only time they're visible)
    return NextResponse.json(
      {
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
        liveApiKey: liveApiKey, // Only returned on creation
        testApiKey: testApiKey, // Only returned on creation
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Tenant creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /v1/tenants - List tenants (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    let query = supabase
      .from('tenants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: tenants, error, count } = await query;

    if (error) {
      console.error('Failed to fetch tenants:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tenants' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      object: 'list',
      data: tenants?.map((t) => ({
        id: t.id,
        object: 'tenant',
        name: t.name,
        email: t.email,
        region: t.region,
        plan: t.plan,
        status: t.status,
        settings: t.settings,
        monthlyScreeningLimit: t.monthly_screening_limit,
        monthlyScreeningsUsed: t.monthly_screenings_used,
        rateLimitPerMinute: t.rate_limit_per_minute,
        liveApiKeyPrefix: t.live_api_key_prefix,
        testApiKeyPrefix: t.test_api_key_prefix,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      hasMore: offset + limit < (count || 0),
      totalCount: count,
    });
  } catch (error) {
    console.error('Tenant list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
