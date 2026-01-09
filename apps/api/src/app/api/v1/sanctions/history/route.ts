import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

const extractedID = (string: string)   => {
  return string.startsWith('cus_') ? string.slice(4) : string;
}

// GET /v1/sanctions/history - Get sanctions screening history
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      let customerId = searchParams.get('customer_id');
      const status = searchParams.get('status');

      let query = supabase
        .from('sanctions_screenings')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('screened_at', { ascending: false })
        .range(offset, offset + limit - 1);



      if (customerId) {
        query = query.eq('customer_id',extractedID(customerId));
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Failed to fetch sanctions history:', error);
        return NextResponse.json(
          { error: 'Failed to fetch screening history' },
          { status: 500 }
        );
      }

      // Transform data to match expected format
      const screenings = (data || []).map((s) => ({
        id: `scr_${s.id}`,
        object: 'screening',
        customerId: s.customer_id,
        screenedName: `${s.screened_first_name} ${s.screened_last_name}`.trim(),
        screenedFirstName: s.screened_first_name,
        screenedLastName: s.screened_last_name,
        screenedDob: s.screened_dob,
        screenedCountry: s.screened_country,
        isMatch: s.is_match,
        matchScore: s.match_score,
        matchedEntities: s.matched_entities,
        status: s.status,
        screeningSources: s.screening_sources,
        screenedAt: s.screened_at,
      }));

      return NextResponse.json({
        object: 'list',
        data: screenings,
        hasMore: (count || 0) > offset + limit,
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('Sanctions history error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch screening history' },
        { status: 500 }
      );
    }
  });
}
