import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { lookupByABN, lookupByACN } from '@/lib/utils/abr-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ABN_LOOKUP_API');

// GET /api/v1/abn-lookup?abn=12345678901
// GET /api/v1/abn-lookup?acn=123456789
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = await new URL(req.url);
      const abn = searchParams.get('abn');
      const acn = searchParams.get('acn');

      if (!abn && !acn) {
        return NextResponse.json(
          { error: 'Either abn or acn parameter is required' },
          { status: 400 }
        );
      }

      let result;
      if (abn) {
        logger.info('Looking up ABN:', abn);
        result = await lookupByABN(abn);
      } else if (acn) {
        logger.info('Looking up ACN:', acn);
        result = await lookupByACN(acn);
      }

      if (!result || !result.success ) {
        return NextResponse.json(
          { error: 'Lookup failed' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        object: 'abr_lookup',
        ...result.data,
      });
    } catch (error) {
      logger.error('[ABN_LOOKUP_GET]', error);
      return NextResponse.json(
        { error: 'Failed to lookup ABN/ACN' },
        { status: 500 }
      );
    }
  });
}
