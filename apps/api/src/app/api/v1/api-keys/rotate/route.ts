import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { generateApiKey } from '@/lib/auth/api-key';
import { createValidationError, createInternalError } from '@/lib/utils/errors';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const body = await req.json();
      const supabase = getServiceClient();

      const keyType = body.keyType;
      if (!keyType || !['live', 'test'].includes(keyType)) {
        return createValidationError('keyType', 'keyType must be "live" or "test"');
      }

      const { key: newKey, prefix: newPrefix, hash: newHash } = generateApiKey(keyType);

      const hashColumn = keyType === 'live' ? 'live_api_key_hash' : 'test_api_key_hash';
      const prefixColumn = keyType === 'live' ? 'live_api_key_prefix' : 'test_api_key_prefix';

      const { error } = await supabase
        .from('tenants')
        .update({
          [hashColumn]: newHash,
          [prefixColumn]: newPrefix,
        })
        .eq('id', tenant.tenantId);

      if (error) {
        console.error('Failed to rotate API key:', error);
        return createInternalError('Failed to rotate API key');
      }

      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'api_key_rotated',
        entity_type: 'tenant',
        entity_id: tenant.tenantId,
        description: `Rotated ${keyType} API key`,
        metadata: { keyType, newPrefix },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'api_key',
        keyType,
        key: newKey,
        prefix: newPrefix,
        message: `Your ${keyType} API key has been rotated. Save this key securely - it will not be shown again.`,
        rotatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('API key rotation error:', error);
      return createInternalError('Failed to rotate API key');
    }
  });
}
