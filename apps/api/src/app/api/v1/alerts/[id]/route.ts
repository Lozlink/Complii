import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/alerts/:id - Get alert
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
      }
      return NextResponse.json(transformAlert(data));
    } catch (error) {
      console.error('Error fetching alert:', error);
      return NextResponse.json({ error: 'Failed to find alert' }, { status: 500 });
    }
  });
}

// PATCH /api/v1/alerts/:id - Update alert
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};

      const fieldMappings: Record<string, string> = {
        status: 'status',
        assignedTo: 'assigned_to',
        investigationNotes: 'investigation_notes',
        resolutionType: 'resolution_type',
        resolutionNotes: 'resolution_notes',
        metadata: 'metadata',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
        if (body[camelKey] !== undefined) {
          updateData[snakeKey] = body[camelKey];
        }
      }

      // Handle status transitions
      if (body.status === 'acknowledged' && !body.acknowledgedAt) {
        updateData.acknowledged_at = new Date().toISOString();
        updateData.acknowledged_by = body.acknowledgedBy || 'api';
      }
      if (body.status === 'resolved' && !body.resolvedAt) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = body.resolvedBy || 'api';
      }
      if (body.assignedTo) {
        updateData.assigned_at = new Date().toISOString();
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'alert.updated',
        entity_type: 'alert',
        entity_id: id,
        description: `Updated alert ${data.alert_number}`,
        metadata: { updatedFields: Object.keys(updateData) },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(transformAlert(data));
    } catch (error) {
      console.error('Error updating alert:', error);
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
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
