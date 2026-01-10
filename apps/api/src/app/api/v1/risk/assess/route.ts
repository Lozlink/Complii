import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import { getComplianceRequirements } from '@/lib/compliance/thresholds';
import { detectStructuring, getStructuringConfigFromRegion } from '@/lib/compliance/structuring-detection';
import { calculateRiskScore, RiskContext } from '@/lib/compliance/risk-scoring';
import { createValidationError, createInternalError, createNotFoundError } from '@/lib/utils/errors';

interface RiskAssessmentBody {
  customerId: string;
  transactionAmount?: number;
  transactionCurrency?: string;
  includeStructuringCheck?: boolean;
}

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body: RiskAssessmentBody = await req.json();

      if (!body.customerId) {
        return createValidationError('customerId', 'customerId is required');
      }

      const { tenant } = req;
      const supabase = getServiceClient();
      const config = getTenantConfig(tenant.region, tenant.settings);

      const customerId = extractCustomerId(body.customerId);

      // Get customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${body.customerId}`)
        .single();

      if (customerError || !customer) {
        return createNotFoundError('Customer');
      }

      const transactionAmount = body.transactionAmount || 0;
      const transactionCurrency = body.transactionCurrency || config.currency;

      // Check structuring if requested
      let structuringDetected = false;
      if (body.includeStructuringCheck && transactionAmount > 0) {
        const structuringConfig = getStructuringConfigFromRegion(config);
        const structuringResult = await detectStructuring(
          supabase,
          tenant.tenantId,
          customer.id,
          transactionAmount,
          structuringConfig
        );
        structuringDetected = structuringResult.isStructuring;
      }

      // Calculate customer age
      const customerCreatedAt = new Date(customer.created_at);
      const customerAgeDays = Math.floor(
        (Date.now() - customerCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get recent transaction count
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentTxCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_id', customer.id)
        .gte('created_at', weekAgo);

      // Build risk context
      const riskContext: RiskContext = {
        transactionAmount,
        transactionCurrency,
        customerAgeDays,
        recentTransactionCount: recentTxCount || 0,
        hasUnusualPattern: structuringDetected,
        customerRequiresEDD: customer.requires_edd || false,
        customer: {
          isPep: customer.is_pep,
          isSanctioned: customer.is_sanctioned,
          verificationStatus: customer.verification_status,
        },
        thresholds: config.thresholds,
      };

      const riskResult = calculateRiskScore(riskContext);

      // Get compliance flags if transaction amount provided
      let complianceFlags = {
        structuring: structuringDetected,
        requiresKyc: false,
        requiresTtr: false,
        requiresEnhancedDd: false,
      };

      if (transactionAmount > 0) {
        const compliance = await getComplianceRequirements(
          supabase,
          tenant.tenantId,
          customer.id,
          transactionAmount,
          config
        );
        complianceFlags = {
          structuring: structuringDetected,
          requiresKyc: compliance.requiresKYC,
          requiresTtr: compliance.requiresTTR,
          requiresEnhancedDd: compliance.requiresEnhancedDD,
        };
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'risk_assessment_performed',
        entity_type: 'customer',
        entity_id: customer.id,
        description: `Risk assessment for customer ${customer.email}`,
        metadata: {
          riskScore: riskResult.riskScore,
          riskLevel: riskResult.riskLevel,
          transactionAmount,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        object: 'risk_assessment',
        customerId: `cus_${customer.id}`,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        factors: riskResult.factors,
        flags: complianceFlags,
        thresholds: {
          kycRequired: config.thresholds.kycRequired,
          ttrRequired: config.thresholds.ttrRequired,
          enhancedDdRequired: config.thresholds.enhancedDdRequired,
        },
        assessedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Risk assessment error:', error);
      return createInternalError('Failed to perform risk assessment');
    }
  });
}
