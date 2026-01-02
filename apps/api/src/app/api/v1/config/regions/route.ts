import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/middleware';
import {
  REGIONAL_CONFIGS,
  getAvailableRegions,
  getTenantConfig,
  FATF_HIGH_RISK_COUNTRIES,
  FATF_INCREASED_MONITORING
} from '@/lib/config/regions';

// GET /api/v1/config/regions - Get available regions and their configurations
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant } = authResult;
  const { searchParams } = new URL(request.url);
  const regionCode = searchParams.get('region');

  // If specific region requested, return full config
  if (regionCode) {
    const config = getTenantConfig(regionCode, tenant.settings || {});
    if (!REGIONAL_CONFIGS[regionCode]) {
      return NextResponse.json(
        { error: 'Invalid region code' },
        { status: 400 }
      );
    }
    return NextResponse.json({
      region: regionCode,
      config,
    });
  }

  // Return list of available regions with summary info
  const regions = getAvailableRegions();
  const tenantConfig = getTenantConfig(tenant.region || 'AU', tenant.settings || {});

  return NextResponse.json({
    available_regions: regions,
    current_region: tenant.region || 'AU',
    current_config: tenantConfig,
    high_risk_jurisdictions: {
      fatf_high_risk: FATF_HIGH_RISK_COUNTRIES,
      fatf_increased_monitoring: FATF_INCREASED_MONITORING,
    },
  });
}
