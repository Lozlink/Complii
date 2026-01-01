import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /v1/webhooks/events - List webhook events (from audit logs)
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
      const offset = parseInt(searchParams.get('offset') || '0');
      const eventType = searchParams.get('type');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Get webhook-related events from audit logs
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false });

      // Filter for webhook-dispatched events
      const webhookActionTypes = [
        'customer_created',
        'customer_updated',
        'customer_deleted',
        'transaction_created',
        'kyc_verification_started',
        'kyc_verification_completed',
        'kyc_verification_failed',
        'screening_match',
        'webhook_dispatched',
      ];

      if (eventType) {
        query = query.eq('action_type', eventType);
      } else {
        query = query.in('action_type', webhookActionTypes);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      query = query.range(offset, offset + limit - 1);

      const { data: events, error, count } = await query;

      if (error) {
        console.error('Failed to fetch webhook events:', error);
        return NextResponse.json(
          { error: 'Failed to fetch webhook events' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        object: 'list',
        data: events?.map((event) => ({
          id: event.id,
          object: 'webhook_event',
          type: event.action_type,
          entityType: event.entity_type,
          entityId: event.entity_id,
          description: event.description,
          metadata: event.metadata,
          createdAt: event.created_at,
        })),
        hasMore: offset + limit < (count || 0),
        totalCount: count,
      });
    } catch (error) {
      console.error('Webhook events error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
