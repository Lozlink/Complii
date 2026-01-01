import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import type { AuthenticatedRequest } from '@/lib/auth/middleware';

// GET /v1/audit-logs - List audit logs
export async function GET(request: NextRequest) {
  const req = request as AuthenticatedRequest;
  const { tenant } = req;
  const supabase = getServiceClient();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(searchParams.get('offset') || '0');
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const actionType = searchParams.get('actionType');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    if (actionType) {
      query = query.eq('action_type', actionType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      object: 'list',
      data: logs?.map((log) => ({
        id: log.id,
        object: 'audit_log',
        actionType: log.action_type,
        entityType: log.entity_type,
        entityId: log.entity_id,
        description: log.description,
        metadata: log.metadata,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        apiKeyPrefix: log.api_key_prefix,
        createdAt: log.created_at,
      })),
      hasMore: offset + limit < (count || 0),
      totalCount: count,
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
