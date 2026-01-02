import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createValidationError, createInternalError } from '@/lib/utils/errors';

const VALID_REGIONS = ['AU', 'NZ', 'GB', 'US', 'EU', 'SG'];

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();

      const { data: tenantData, error } = await supabase
        .from('tenants')
        .select('id, name, email, region, settings, live_api_key_prefix, test_api_key_prefix, created_at, updated_at')
        .eq('id', tenant.tenantId)
        .single();

      if (error || !tenantData) {
        return createInternalError('Failed to fetch tenant settings');
      }

      return NextResponse.json({
        object: 'tenant_settings',
        id: tenantData.id,
        name: tenantData.name,
        email: tenantData.email,
        region: tenantData.region,
        settings: tenantData.settings,
        liveApiKeyPrefix: tenantData.live_api_key_prefix,
        testApiKeyPrefix: tenantData.test_api_key_prefix,
        createdAt: tenantData.created_at,
        updatedAt: tenantData.updated_at,
      });
    } catch (error) {
      console.error('Tenant settings fetch error:', error);
      return createInternalError('Failed to fetch tenant settings');
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const body = await req.json();
      const supabase = getServiceClient();

      if (body.region && !VALID_REGIONS.includes(body.region)) {
        return createValidationError('region', `Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}`);
      }

      const updates: Record<string, unknown> = {};
      if (body.region !== undefined) updates.region = body.region;
      if (body.settings !== undefined) {
        updates.settings = { ...tenant.settings, ...body.settings };
      }

      const { data: updatedTenant, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenant.tenantId)
        .select('id, name, region, settings, updated_at')
        .single();

      if (error || !updatedTenant) {
        return createInternalError('Failed to update tenant settings');
      }

      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'tenant_settings_updated',
        entity_type: 'tenant',
        entity_id: tenant.tenantId,
        description: 'Updated tenant settings',
        metadata: { updatedFields: Object.keys(updates) },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'tenant_settings',
        id: updatedTenant.id,
        name: updatedTenant.name,
        region: updatedTenant.region,
        settings: updatedTenant.settings,
        updatedAt: updatedTenant.updated_at,
      });
    } catch (error) {
      console.error('Tenant settings update error:', error);
      return createInternalError('Failed to update tenant settings');
    }
  });
}
