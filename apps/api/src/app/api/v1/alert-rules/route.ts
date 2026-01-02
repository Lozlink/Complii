import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/client';
import { createAuditLog } from '@/lib/utils/audit';

// GET /api/v1/alert-rules - List alert rules
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenant } = authResult;
  const { searchParams } = new URL(request.url);

  const ruleType = searchParams.get('rule_type');
  const entityType = searchParams.get('entity_type');
  const isEnabled = searchParams.get('is_enabled');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const startingAfter = searchParams.get('starting_after');

  let query = supabaseAdmin
    .from('alert_rules')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (ruleType) query = query.eq('rule_type', ruleType);
  if (entityType) query = query.eq('entity_type', entityType);
  if (isEnabled !== null) query = query.eq('is_enabled', isEnabled === 'true');
  if (startingAfter) query = query.lt('id', startingAfter);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    object: 'list',
    data: data?.map(transformAlertRule) || [],
    hasMore: (count || 0) > limit,
    totalCount: count || 0,
  });
}

// POST /api/v1/alert-rules - Create alert rule
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
    ruleName,
    ruleCode,
    description,
    ruleType,
    entityType,
    conditions,
    severity = 'medium',
    autoCreateCase = false,
    caseType,
    casePriority,
    notificationChannels = ['dashboard'],
    notificationRecipients = [],
    cooldownMinutes = 60,
    maxAlertsPerDay = 100,
    isEnabled = true,
    jurisdictions = ['AU'],
    metadata,
  } = body;

  if (!ruleName || !ruleCode || !ruleType || !entityType || !conditions) {
    return NextResponse.json(
      { error: 'ruleName, ruleCode, ruleType, entityType, and conditions are required' },
      { status: 400 }
    );
  }

  // Check for duplicate rule code
  const { data: existing } = await supabaseAdmin
    .from('alert_rules')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('rule_code', ruleCode)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Alert rule with code '${ruleCode}' already exists` },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('alert_rules')
    .insert({
      tenant_id: tenant.id,
      rule_name: ruleName,
      rule_code: ruleCode,
      description,
      rule_type: ruleType,
      entity_type: entityType,
      conditions,
      severity,
      auto_create_case: autoCreateCase,
      case_type: caseType,
      case_priority: casePriority,
      notification_channels: notificationChannels,
      notification_recipients: notificationRecipients,
      cooldown_minutes: cooldownMinutes,
      max_alerts_per_day: maxAlertsPerDay,
      is_enabled: isEnabled,
      jurisdictions,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(supabaseAdmin, {
    tenantId: tenant.id,
    actionType: 'alert_rule.created',
    entityType: 'alert_rule',
    entityId: data.id,
    description: `Created alert rule: ${ruleName}`,
    apiKeyPrefix,
    request,
  });

  return NextResponse.json(transformAlertRule(data), { status: 201 });
}

function transformAlertRule(row: Record<string, unknown>) {
  return {
    id: row.id,
    object: 'alert_rule',
    ruleName: row.rule_name,
    ruleCode: row.rule_code,
    description: row.description,
    ruleType: row.rule_type,
    entityType: row.entity_type,
    conditions: row.conditions,
    severity: row.severity,
    autoCreateCase: row.auto_create_case,
    caseType: row.case_type,
    casePriority: row.case_priority,
    notificationChannels: row.notification_channels,
    notificationRecipients: row.notification_recipients,
    cooldownMinutes: row.cooldown_minutes,
    maxAlertsPerDay: row.max_alerts_per_day,
    isEnabled: row.is_enabled,
    isSystemRule: row.is_system_rule,
    jurisdictions: row.jurisdictions,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
