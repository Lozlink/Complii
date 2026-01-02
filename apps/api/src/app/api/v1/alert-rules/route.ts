import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /api/v1/alert-rules - List alert rules
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();

      const { searchParams } = new URL(request.url);

      const ruleType = searchParams.get('rule_type');
      const entityType = searchParams.get('entity_type');
      const isEnabled = searchParams.get('is_enabled');
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
      const startingAfter = searchParams.get('starting_after');

      let query = supabase
        .from('alert_rules')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
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
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      return NextResponse.json(
        { error: 'Failed to list alert rules' },
        { status: 500 }
      );
    }
  });
}

// POST /api/v1/alert-rules - Create alert rule
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const body = await req.json();

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
        notificationChannels = [],
        notificationRecipients = [],
        cooldownMinutes = 0,
        maxAlertsPerDay,
        jurisdictions,
        metadata,
      } = body;

      if (!ruleName || !ruleCode || !ruleType || !entityType || !conditions) {
        return NextResponse.json(
          { error: 'ruleName, ruleCode, ruleType, entityType, and conditions are required' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('alert_rules')
        .insert({
          tenant_id: tenant.tenantId,
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
          jurisdictions,
          metadata: metadata || {},
          created_by: 'api',
        })
        .select()
        .single();

      if (error) {
        console.error('Alert rule create error:', error);
        return NextResponse.json(
          { error: 'Failed to create alert rule' },
          { status: 500 }
        );
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'alert_rule.created',
        entity_type: 'alert_rule',
        entity_id: data.id,
        description: `Created alert rule ${ruleCode}: ${ruleName}`,
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(transformAlertRule(data), { status: 201 });
    } catch (error) {
      console.error('Alert rule create error:', error);
      return NextResponse.json(
        { error: 'Failed to create alert rule' },
        { status: 500 }
      );
    }
  });
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
