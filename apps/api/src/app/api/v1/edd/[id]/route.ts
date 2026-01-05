import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import {
  updateEDDStatus,
  requestEDDInformation,
  escalateEDDInvestigation,
  completeEDDInvestigation,
} from '@/lib/compliance/edd-service';

/**
 * GET /api/v1/edd/[id] - Get single EDD investigation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const { id } = await params;
      const supabase = getServiceClient();

      const { data: investigation, error } = await supabase
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
            is_pep,
            customer_type,
            company_name
          ),
          transactions (
            id,
            amount,
            currency,
            created_at,
            transaction_type,
            description
          )
        `
        )
        .eq('id', id)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (error || !investigation) {
        return NextResponse.json(
          { error: 'Investigation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        object: 'edd_investigation',
        ...transformInvestigation(investigation),
      });
    } catch (error) {
      console.error('Error fetching EDD investigation:', error);
      return NextResponse.json(
        { error: 'Failed to fetch investigation' },
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/v1/edd/[id] - Update EDD investigation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const { id } = await params;
      const supabase = getServiceClient();

      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const { action } = body;

      switch (action) {
        case 'update_status': {
          const { status } = body;
          if (!status) {
            return NextResponse.json(
              { error: 'status is required' },
              { status: 400 }
            );
          }
          const result = await updateEDDStatus(supabase, tenant.tenantId, id, status);
          if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
          }
          return NextResponse.json({ success: true, status });
        }

        case 'request_information': {
          const { items, deadline, requestedBy } = body;
          if (!items || !Array.isArray(items)) {
            return NextResponse.json(
              { error: 'items array is required' },
              { status: 400 }
            );
          }
          const result = await requestEDDInformation(supabase, tenant.tenantId, id, {
            items,
            deadline,
            requestedBy,
          });
          if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
          }
          return NextResponse.json({ success: true, requestId: result.requestId });
        }

        case 'escalate': {
          const { reason, escalatedTo, escalatedBy } = body;
          if (!reason) {
            return NextResponse.json(
              { error: 'reason is required' },
              { status: 400 }
            );
          }
          const result = await escalateEDDInvestigation(supabase, tenant.tenantId, id, {
            reason,
            escalatedTo,
            escalatedBy,
          });
          if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
          }
          return NextResponse.json({ success: true, message: 'Investigation escalated' });
        }

        case 'complete': {
          const {
            investigationFindings,
            riskAssessmentSummary,
            complianceRecommendation,
            reviewedBy,
          } = body;
          if (!investigationFindings || !riskAssessmentSummary || !complianceRecommendation) {
            return NextResponse.json(
              {
                error:
                  'investigationFindings, riskAssessmentSummary, and complianceRecommendation are required',
              },
              { status: 400 }
            );
          }
          const result = await completeEDDInvestigation(supabase, tenant.tenantId, id, {
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
          });
        }

        case 'update_checklist': {
          const { sectionName, sectionData } = body;
          if (!sectionName || !sectionData) {
            return NextResponse.json(
              { error: 'sectionName and sectionData are required' },
              { status: 400 }
            );
          }

          const validSections = [
            'customer_information_review',
            'employment_verification',
            'source_of_wealth',
            'source_of_funds',
            'transaction_pattern_analysis',
            'additional_information',
          ];

          if (!validSections.includes(sectionName)) {
            return NextResponse.json(
              { error: 'Invalid section name' },
              { status: 400 }
            );
          }

          // Get current investigation
          const { data: investigation } = await supabase
            .from('edd_investigations')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenant.tenantId)
            .single();

          if (!investigation) {
            return NextResponse.json(
              { error: 'Investigation not found' },
              { status: 404 }
            );
          }

          // Merge section data
          const existingSection = ((investigation as Record<string, unknown>)[sectionName] as Record<string, unknown>) || {};
          const updatedSection = {
            ...existingSection,
            ...sectionData,
            reviewed_at: new Date().toISOString(),
          };

          // Update investigation
          const { error: updateError } = await supabase
            .from('edd_investigations')
            .update({ [sectionName]: updatedSection })
            .eq('id', id)
            .eq('tenant_id', tenant.tenantId);

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }

          // Audit log
          await supabase.from('audit_logs').insert({
            tenant_id: tenant.tenantId,
            action_type: 'edd_checklist_updated',
            entity_type: 'edd_investigation',
            entity_id: id,
            description: `Checklist section updated: ${sectionName}`,
            metadata: { section_name: sectionName, completed: sectionData.completed },
          });

          return NextResponse.json({ success: true, section: sectionName });
        }

        case 'assign': {
          const { assignedTo } = body;
          const { error: updateError } = await supabase
            .from('edd_investigations')
            .update({ assigned_to: assignedTo })
            .eq('id', id)
            .eq('tenant_id', tenant.tenantId);

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }

          return NextResponse.json({ success: true, assignedTo });
        }

        default:
          // Direct field updates (without action)
          const allowedFields = [
            'assigned_to',
            'investigation_findings',
            'risk_assessment_summary',
          ];
          const updates: Record<string, unknown> = {};

          for (const field of allowedFields) {
            if (body[field] !== undefined) {
              updates[field] = body[field];
            }
          }

          if (Object.keys(updates).length === 0) {
            return NextResponse.json(
              { error: 'No valid fields to update or invalid action' },
              { status: 400 }
            );
          }

          const { error: directUpdateError } = await supabase
            .from('edd_investigations')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', tenant.tenantId);

          if (directUpdateError) {
            return NextResponse.json(
              { error: directUpdateError.message },
              { status: 500 }
            );
          }

          return NextResponse.json({ success: true, updated: Object.keys(updates) });
      }
    } catch (error) {
      console.error('EDD PATCH error:', error);
      return NextResponse.json(
        { error: 'Failed to update investigation' },
        { status: 500 }
      );
    }
  });
}

// Transform database row to API response
function transformInvestigation(row: Record<string, unknown>) {
  const customer = row.customers as Record<string, unknown> | null;
  const transaction = row.transactions as Record<string, unknown> | null;

  return {
    id: row.id,
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
          type: customer.customer_type,
          name:
            customer.customer_type === 'business'
              ? customer.company_name
              : `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
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
          type: transaction.transaction_type,
          description: transaction.description,
          date: transaction.created_at,
        }
      : null,
    // Checklist sections
    checklistSections: {
      customerInformationReview: row.customer_information_review,
      employmentVerification: row.employment_verification,
      sourceOfWealth: row.source_of_wealth,
      sourceOfFunds: row.source_of_funds,
      transactionPatternAnalysis: row.transaction_pattern_analysis,
      additionalInformation: row.additional_information,
    },
    // Findings
    investigationFindings: row.investigation_findings,
    riskAssessmentSummary: row.risk_assessment_summary,
    complianceRecommendation: row.compliance_recommendation,
    // Requests and escalations
    informationRequests: row.information_requests,
    escalations: row.escalations,
    // Review info
    reviewedBy: row.reviewed_by,
    // Dates
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

