import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import {
  createEDDInvestigation,
  updateEDDStatus,
  requestEDDInformation,
  escalateEDDInvestigation,
  completeEDDInvestigation,
} from '@/lib/compliance/edd-service';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatcher';

/**
 * GET /api/v1/edd - List EDD investigations
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const status = searchParams.get('status');
      const customerId = searchParams.get('customerId');
      const transactionId = searchParams.get('transactionId');
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
      const startingAfter = searchParams.get('starting_after');

      let query = supabase
        .from('edd_investigations')
        .select(
          `
          *,
          customers!customer_id (
            id,
            first_name,
            last_name,
            email,
            risk_level,
            is_pep
          ),
          transactions (
            id,
            amount,
            currency,
            created_at
          )
        `,
          { count: 'exact' }
        )
        .eq('tenant_id', tenant.tenantId)
        .order('opened_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (status && status !== 'all') {
        if (status === 'active') {
          query = query.in('status', [
            'open',
            'awaiting_customer_info',
            'under_review',
            'escalated',
          ]);
        } else {
          query = query.eq('status', status);
        }
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (transactionId) {
        query = query.eq('transaction_id', transactionId);
      }

      if (startingAfter) {
        query = query.lt('id', startingAfter);
      }

      const { data: investigations, error, count } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        object: 'list',
        data: (investigations || []).map(transformInvestigation),
        hasMore: (count || 0) > limit,
        totalCount: count || 0,
      });
    } catch (error) {
      console.error('Error fetching EDD investigations:', error);
      return NextResponse.json(
        { error: 'Failed to list investigations' },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/v1/edd - Create or update EDD investigation
 */
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

      const { action = 'create' } = body;

      switch (action) {
        case 'create':
          return await handleCreate(supabase, tenant.tenantId, body);

        case 'request_information':
          return await handleRequestInfo(supabase, tenant.tenantId, body);

        case 'escalate':
          return await handleEscalate(supabase, tenant.tenantId, body);

        case 'complete':
          return await handleComplete(supabase, tenant.tenantId, body);

        case 'update_status':
          return await handleUpdateStatus(supabase, tenant.tenantId, body);

        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    } catch (error) {
      console.error('EDD POST error:', error);
      return NextResponse.json(
        { error: 'Failed to process EDD request' },
        { status: 500 }
      );
    }
  });
}

// Action handlers

async function handleCreate(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  body: Record<string, unknown>
) {
  const {
    customerId,
    transactionId,
    triggerReason,
    triggeredBy = 'system',
    assignedTo,
  } = body as {
    customerId?: string;
    transactionId?: string;
    triggerReason?: string;
    triggeredBy?: 'admin' | 'system' | 'transaction_review';
    assignedTo?: string;
  };

  if (!customerId || !triggerReason) {
    return NextResponse.json(
      { error: 'customerId and triggerReason are required' },
      { status: 400 }
    );
  }

  const result = await createEDDInvestigation(supabase, tenantId, {
    customerId,
    transactionId,
    triggerReason,
    triggeredBy,
    assignedTo,
  });

  if (!result.success) {
    const statusCode = result.existingInvestigation ? 409 : 400;
    return NextResponse.json(
      {
        error: result.error,
        existingInvestigation: result.existingInvestigation,
      },
      { status: statusCode }
    );
  }

  return NextResponse.json(
    transformInvestigation(result.investigation as unknown as Record<string, unknown>),
    { status: 201 }
  );
}

async function handleRequestInfo(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  body: Record<string, unknown>
) {
  const { investigationId, items, deadline, requestedBy } = body as {
    investigationId?: string;
    items?: string[];
    deadline?: string;
    requestedBy?: string;
  };

  if (!investigationId || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'investigationId and items array are required' },
      { status: 400 }
    );
  }

  const result = await requestEDDInformation(supabase, tenantId, investigationId, {
    items,
    deadline,
    requestedBy,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    requestId: result.requestId,
    message: 'Information request created',
  });
}

async function handleEscalate(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  body: Record<string, unknown>
) {
  const { investigationId, reason, escalatedTo, escalatedBy } = body as {
    investigationId?: string;
    reason?: string;
    escalatedTo?: string;
    escalatedBy?: string;
  };

  if (!investigationId || !reason) {
    return NextResponse.json(
      { error: 'investigationId and reason are required' },
      { status: 400 }
    );
  }

  const result = await escalateEDDInvestigation(supabase, tenantId, investigationId, {
    reason,
    escalatedTo,
    escalatedBy,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Dispatch webhook for escalation
  await dispatchWebhookEvent(supabase, tenantId, 'alert.escalated', {
    type: 'edd_escalation',
    investigationId,
    reason,
    escalatedTo: escalatedTo || 'management',
  });

  return NextResponse.json({
    success: true,
    message: 'Investigation escalated',
  });
}

async function handleComplete(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  body: Record<string, unknown>
) {
  const {
    investigationId,
    investigationFindings,
    riskAssessmentSummary,
    complianceRecommendation,
    reviewedBy,
  } = body as {
    investigationId?: string;
    investigationFindings?: string;
    riskAssessmentSummary?: string;
    complianceRecommendation?:
      | 'approve_relationship'
      | 'ongoing_monitoring'
      | 'enhanced_monitoring'
      | 'reject_relationship'
      | 'escalate_to_smr';
    reviewedBy?: string;
  };

  if (
    !investigationId ||
    !investigationFindings ||
    !riskAssessmentSummary ||
    !complianceRecommendation
  ) {
    return NextResponse.json(
      {
        error:
          'investigationId, investigationFindings, riskAssessmentSummary, and complianceRecommendation are required',
      },
      { status: 400 }
    );
  }

  const result = await completeEDDInvestigation(supabase, tenantId, investigationId, {
    investigationFindings,
    riskAssessmentSummary,
    complianceRecommendation,
    reviewedBy,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    monitoringLevel: result.monitoringLevel,
    message: `Investigation completed with recommendation: ${complianceRecommendation}`,
  });
}

async function handleUpdateStatus(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  body: Record<string, unknown>
) {
  const { investigationId, status } = body as {
    investigationId?: string;
    status?: string;
  };

  if (!investigationId || !status) {
    return NextResponse.json(
      { error: 'investigationId and status are required' },
      { status: 400 }
    );
  }

  const result = await updateEDDStatus(supabase, tenantId, investigationId, status);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: `Status updated to: ${status}`,
  });
}

// Transform database row to API response
function transformInvestigation(row: Record<string, unknown>) {
  const customer = row.customers as Record<string, unknown> | null;
  const transaction = row.transactions as Record<string, unknown> | null;

  return {
    id: row.id,
    object: 'edd_investigation',
    investigationNumber: row.investigation_number,
    customerId: row.customer_id,
    transactionId: row.transaction_id,
    status: row.status,
    triggerReason: row.trigger_reason,
    triggeredBy: row.triggered_by,
    assignedTo: row.assigned_to,
    // Customer info
    customer: customer
      ? {
          id: customer.id,
          name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          email: customer.email,
          riskLevel: customer.risk_level,
          isPep: customer.is_pep,
        }
      : null,
    // Transaction info
    transaction: transaction
      ? {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          date: transaction.created_at,
        }
      : null,
    // Findings
    investigationFindings: row.investigation_findings,
    riskAssessmentSummary: row.risk_assessment_summary,
    complianceRecommendation: row.compliance_recommendation,
    // Requests and escalations
    informationRequests: row.information_requests,
    escalations: row.escalations,
    // Dates
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
