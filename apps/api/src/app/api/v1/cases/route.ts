import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/client';
import { createAuditLog } from '@/lib/utils/audit';

// GET /api/v1/cases - List cases
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant } = authResult;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const caseType = searchParams.get('case_type');
  const priority = searchParams.get('priority');
  const customerId = searchParams.get('customer_id');
  const assignedTo = searchParams.get('assigned_to');
  const isEscalated = searchParams.get('is_escalated');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const startingAfter = searchParams.get('starting_after');

  let query = supabaseAdmin
    .from('cases')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (caseType) query = query.eq('case_type', caseType);
  if (priority) query = query.eq('priority', priority);
  if (customerId) query = query.eq('customer_id', customerId);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);
  if (isEscalated !== null) query = query.eq('is_escalated', isEscalated === 'true');
  if (startingAfter) query = query.lt('id', startingAfter);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    object: 'list',
    data: data?.map(transformCase) || [],
    hasMore: (count || 0) > limit,
    totalCount: count || 0,
  });
}

// POST /api/v1/cases - Create case
export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant, apiKeyPrefix } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    title,
    description,
    caseType,
    priority = 'medium',
    customerId,
    transactionIds,
    assignedTo,
    department,
    dueDate,
    tags,
    metadata,
  } = body;

  if (!title || !caseType) {
    return NextResponse.json(
      { error: 'title and caseType are required' },
      { status: 400 }
    );
  }

  // Generate case number
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('created_at', `${year}-01-01`);

  const caseNumber = `CASE-${year}-${String((count || 0) + 1).padStart(6, '0')}`;

  const { data, error } = await supabaseAdmin
    .from('cases')
    .insert({
      tenant_id: tenant.id,
      case_number: caseNumber,
      title,
      description,
      case_type: caseType,
      priority,
      customer_id: customerId,
      transaction_ids: transactionIds || [],
      assigned_to: assignedTo,
      assigned_at: assignedTo ? new Date().toISOString() : null,
      department,
      due_date: dueDate,
      tags: tags || [],
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(supabaseAdmin, {
    tenantId: tenant.id,
    actionType: 'case.created',
    entityType: 'case',
    entityId: data.id,
    description: `Created case ${caseNumber}: ${title}`,
    apiKeyPrefix,
    request,
  });

  return NextResponse.json(transformCase(data), { status: 201 });
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
