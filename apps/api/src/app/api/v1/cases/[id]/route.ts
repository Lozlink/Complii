import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/cases/:id - Get case
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      return NextResponse.json(transformCase(data));
    } catch (error) {
      console.error('Error fetching case:', error);
      return NextResponse.json({ error: 'Failed to find case' }, { status: 500 });
    }
  });
}

// PATCH /api/v1/cases/:id - Update case
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
        title: 'title',
        description: 'description',
        priority: 'priority',
        status: 'status',
        assignedTo: 'assigned_to',
        department: 'department',
        dueDate: 'due_date',
        resolutionType: 'resolution_type',
        resolutionSummary: 'resolution_summary',
        resolutionNotes: 'resolution_notes',
        tags: 'tags',
        metadata: 'metadata',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMappings)) {
        if (body[camelKey] !== undefined) {
          updateData[snakeKey] = body[camelKey];
        }
      }

      // Handle status transitions
      if (body.status === 'resolved' && !body.resolvedAt) {
        updateData.resolved_at = new Date().toISOString();
      }
      if (body.status === 'closed' && !body.closedAt) {
        updateData.closed_at = new Date().toISOString();
      }
      if (body.assignedTo && body.assignedTo !== undefined) {
        updateData.assigned_at = new Date().toISOString();
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'case.updated',
        entity_type: 'case',
        entity_id: id,
        description: `Updated case ${data.case_number}`,
        metadata: { updatedFields: Object.keys(updateData) },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(transformCase(data));
    } catch (error) {
      console.error('Error updating case:', error);
      return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
    }
  });
}

// DELETE /api/v1/cases/:id - Delete case (soft delete by closing)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { id } = await params;

      // Soft delete by setting status to closed
      const { data, error } = await supabase
        .from('cases')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closure_reason: 'Deleted via API',
        })
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'case.closed',
        entity_type: 'case',
        entity_id: id,
        description: `Closed case ${data.case_number}`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({ deleted: true, id });
    } catch (error) {
      console.error('Error deleting case:', error);
      return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
    }
  });
}

function transformCase(row: Record<string, unknown>) {
  return {
    id: row.id,
    object: 'case',
    caseNumber: row.case_number,
    title: row.title,
    description: row.description,
    caseType: row.case_type,
    priority: row.priority,
    status: row.status,
    customerId: row.customer_id,
    transactionIds: row.transaction_ids,
    smrReportId: row.smr_report_id,
    iftiReportId: row.ifti_report_id,
    alertId: row.alert_id,
    assignedTo: row.assigned_to,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    department: row.department,
    dueDate: row.due_date,
    slaDeadline: row.sla_deadline,
    isEscalated: row.is_escalated,
    escalatedTo: row.escalated_to,
    escalationReason: row.escalation_reason,
    escalatedAt: row.escalated_at,
    escalationLevel: row.escalation_level,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionType: row.resolution_type,
    resolutionSummary: row.resolution_summary,
    resolutionNotes: row.resolution_notes,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closureReason: row.closure_reason,
    documents: row.documents,
    tags: row.tags,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
