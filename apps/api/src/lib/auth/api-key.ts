import bcrypt from 'bcryptjs';
import { getServiceClient } from '../db/client';

export interface TenantContext {
  tenantId: string;
  isTestMode: boolean;
  region: string;
  plan: string;
  rateLimitPerMinute: number;
  settings: Record<string, unknown>;
  apiKeyPrefix: string;
}

export async function validateApiKey(apiKey: string): Promise<TenantContext | null> {
  // Validate format
  if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
    return null;
  }

  const isTestMode = apiKey.startsWith('sk_test_');
  const prefix = apiKey.substring(0, 15); // sk_live_abc or sk_test_abc

  const supabase = getServiceClient();

  const keyColumn = isTestMode ? 'test_api_key_prefix' : 'live_api_key_prefix';
  const hashColumn = isTestMode ? 'test_api_key_hash' : 'live_api_key_hash';

  // Find tenant by prefix
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select(`id, ${hashColumn}, region, plan, rate_limit_per_minute, settings, status`)
    .eq(keyColumn, prefix)
    .eq('status', 'active');

  if (error || !tenants || tenants.length === 0) {
    return null;
  }

  const tenant = tenants[0];

  // Verify full key hash
  const hash = tenant[hashColumn as keyof typeof tenant] as string;
  if (!hash) {
    return null;
  }

  const isValid = await bcrypt.compare(apiKey, hash);
  if (!isValid) {
    return null;
  }

  return {
    tenantId: tenant.id,
    isTestMode,
    region: tenant.region,
    plan: tenant.plan,
    rateLimitPerMinute: tenant.rate_limit_per_minute,
    settings: tenant.settings as Record<string, unknown>,
    apiKeyPrefix: prefix,
  };
}

export function generateApiKey(mode: 'live' | 'test'): {
  key: string;
  prefix: string;
  hash: string;
} {
  const prefix = `sk_${mode}_`;
  const randomPart = generateRandomString(32);
  const key = prefix + randomPart;
  const keyPrefix = key.substring(0, 15);
  const hash = bcrypt.hashSync(key, 10);

  return { key, prefix: keyPrefix, hash };
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}
