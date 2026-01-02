import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /api/v1/alerts - List alerts
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const status = searchParams.get('status');
      const severity = searchParams.get('severity');
      const entityType = searchParams.get('entity_type');
      const customerId = searchParams.get('customer_id');
      const alertRuleId = searchParams.get('alert_rule_id');
      const assignedTo = searchParams.get('assigned_to');
      const isEscalated = searchParams.get('is_escalated');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const startingAfter = searchParams.get('starting_after');

      let query = supabase
        .from('alerts')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);
      if (severity) query = query.eq('severity', severity);
      if (entityType) query = query.eq('entity_type', entityType);
      if (customerId) query = query.eq('customer_id', customerId);
      if (alertRuleId) query = query.eq('alert_rule_id', alertRuleId);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (isEscalated !== null) query = query.eq('is_escalated', isEscalated === 'true');
      if (startingAfter) query = query.lt('id', startingAfter);

      const { data, error, count } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        object: 'list',
        data: data?.map(transformAlert) || [],
        hasMore: (count || 0) > limit,
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ error: 'Failed to list alerts' }, { status: 500 });
    }
  });
}

// POST /api/v1/alerts - Create alert (usually triggered by system, but can be manual)
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();

      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const {
        alertRuleId,
        title,
        description,
        severity = 'medium',
        entityType,
        entityId,
        customerId,
        triggerData = {},
        metadata,
      } = body;

      if (!title || !entityType || !entityId) {
        return NextResponse.json(
          { error: 'title, entityType, and entityId are required' },
          { status: 400 }
        );
      }

      // Generate alert number
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const { count } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .gte('created_at', new Date().toISOString().slice(0, 10));

      const alertNumber = `ALT-${today}-${String((count || 0) + 1).padStart(4, '0')}`;

      const { data, error } = await supabase
        .from('alerts')
        .insert({
          tenant_id: tenant.tenantId,
          alert_number: alertNumber,
          alert_rule_id: alertRuleId,
          title,
          description,
          severity,
          entity_type: entityType,
          entity_id: entityId,
          customer_id: customerId,
          trigger_data: triggerData,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'alert.created',
        entity_type: 'alert',
        entity_id: data.id,
        description: `Created alert ${alertNumber}: ${title}`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(transformAlert(data), { status: 201 });
    } catch (error) {
      console.error('Alert create error:', error);
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }
  });
}

function transformAlert(row: Record<string, unknown>) {
  return {
    id: row.id,
    object: 'alert',
    alertNumber: row.alert_number,
    alertRuleId: row.alert_rule_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    entityType: row.entity_type,
    entityId: row.entity_id,
    customerId: row.customer_id,
    triggerData: row.trigger_data,
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    assignedTo: row.assigned_to,
    assignedAt: row.assigned_at,
    investigationNotes: row.investigation_notes,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionType: row.resolution_type,
    resolutionNotes: row.resolution_notes,
    isEscalated: row.is_escalated,
    escalatedTo: row.escalated_to,
    escalationReason: row.escalation_reason,
    escalatedAt: row.escalated_at,
    caseId: row.case_id,
    notificationsSent: row.notifications_sent,
    slaDeadline: row.sla_deadline,
    slaBreached: row.sla_breached,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
