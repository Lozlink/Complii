import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /v1/webhooks/deliveries - Get webhook delivery history
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const webhookId = searchParams.get('webhook_id');
      const status = searchParams.get('status');
      const eventType = searchParams.get('event_type');

      let query = supabase
        .from('webhook_deliveries')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (webhookId) {
        // Parse webhook ID if it has prefix
        const parsedId = webhookId.startsWith('whk_')
          ? webhookId.slice(4)
          : webhookId;
        query = query.ilike('webhook_endpoint_id', `${parsedId}%`);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Failed to fetch webhook deliveries:', error);
        return NextResponse.json(
          { error: 'Failed to fetch webhook deliveries' },
          { status: 500 }
        );
      }

      // Transform data to match expected format
      const deliveries = (data || []).map((d) => ({
        id: `evt_${d.id.slice(0, 8)}`,
        object: 'webhook_delivery',
        webhookEndpointId: d.webhook_endpoint_id
          ? `whk_${d.webhook_endpoint_id.slice(0, 8)}`
          : null,
        eventId: d.event_id,
        eventType: d.event_type,
        status: d.status,
        attempts: d.attempts,
        responseStatus: d.response_status,
        deliveredAt: d.delivered_at,
        nextRetryAt: d.next_retry_at,
        createdAt: d.created_at,
      }));

      return NextResponse.json({
        object: 'list',
        data: deliveries,
        hasMore: (count || 0) > offset + limit,
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('Webhook deliveries error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch webhook deliveries' },
        { status: 500 }
      );
    }
  });
}
