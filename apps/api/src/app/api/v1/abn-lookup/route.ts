import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { createValidationError } from '@/lib/utils/errors';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const abn = searchParams.get('abn');

    if (!abn) {
      return createValidationError('abn', 'ABN parameter is required');
    }

    const abnClean = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(abnClean)) {
      return createValidationError('abn', 'ABN must be 11 digits');
    }

    // Mock response - TODO: Replace with real ABR API integration
    return NextResponse.json({
      object: 'abn_lookup',
      abn: abnClean,
      acn: abnClean.substring(2),
      name: `Business ${abnClean.substring(0, 4)} Pty Ltd`,
      tradingName: `Trading As ${abnClean.substring(0, 4)}`,
      status: 'active',
      statusEffectiveFrom: '2020-01-01',
      entityType: 'Australian Private Company',
      entityTypeCode: 'PRV',
      gst: { registered: true, registeredFrom: '2020-01-01' },
      address: { state: 'NSW', postcode: '2000' },
      isMock: true,
    });
  });
}
