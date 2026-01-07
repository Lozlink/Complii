import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { calculateBusinessRiskScore, getBusinessRiskLevel, shouldBlockBusiness } from '@/lib/compliance/business-risk-scoring';
import { createLogger } from '@/lib/utils/logger';
import type { EntityType } from '@/types/business';

const logger = createLogger('BUSINESS_REGISTER_API');

// POST /api/v1/business/register
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const body = await req.json();

      const {
        primaryContactCustomerId,
        entityType,
        abn,
        acn,
        businessName,
        tradingName,
        abrResponse,
        registeredAddress,
        principalAddress,
        industryCode,
        industryDescription,
      } = body;

      // Validation
      if (!primaryContactCustomerId || !entityType || !abn || !businessName) {
        return NextResponse.json(
          { error: 'primaryContactCustomerId, entityType, abn, and businessName are required' },
          { status: 400 }
        );
      }

      // Verify primary contact belongs to this tenant
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', primaryContactCustomerId)
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (!customer) {
        return NextResponse.json(
          { error: 'Primary contact customer not found' },
          { status: 404 }
        );
      }

      // Check for existing business with this ABN
      const { data: existing } = await supabase
        .from('business_customers')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .eq('abn', abn)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'A business with this ABN is already registered' },
          { status: 409 }
        );
      }

      // Calculate initial risk score
      const riskFactors = {
        entityType: entityType as EntityType,
        yearsInOperation: 0, // New business, will be updated after verification
        industryCode,
        abnStatus: abrResponse?.abnStatus || 'Active',
        gstRegistered: abrResponse?.gstRegistered || false,
        uboCount: 0,
        ubos: [], // No UBOs yet at registration
        isInterstate: false, // Can be determined from addresses later
        transactionAmount: 0,
        hasMultipleRecentTransactions: false,
        unusualPattern: false
      };

      const riskScore = calculateBusinessRiskScore(riskFactors);
      const riskLevel = getBusinessRiskLevel(riskScore);
      const blockCheck = shouldBlockBusiness(riskFactors);

      // Create business customer record
      const { data: business, error } = await supabase
        .from('business_customers')
        .insert({
          tenant_id: tenant.tenantId,
          primary_contact_customer_id: primaryContactCustomerId,
          entity_type: entityType,
          abn,
          acn,
          business_name: businessName,
          trading_name: tradingName,
          abr_verified: !!abrResponse,
          abr_verified_at: abrResponse ? new Date().toISOString() : null,
          abr_response: abrResponse || null,
          gst_registered: abrResponse?.gstRegistered || false,
          gst_registered_date: abrResponse?.gstRegisteredDate || null,
          entity_status: abrResponse?.abnStatus || 'Unknown',
          main_business_location: abrResponse?.mainBusinessLocation || null,
          registered_address: registeredAddress || null,
          principal_address: principalAddress || registeredAddress || null,
          industry_code: industryCode,
          industry_description: industryDescription,
          verification_status: 'pending',
          risk_score: riskScore,
          risk_level: riskLevel,
          ubo_verification_complete: false,
          requires_enhanced_dd: riskLevel === 'high' || blockCheck.blocked,
          edd_completed: false,
          monitoring_level: blockCheck.blocked ? 'blocked' : riskLevel === 'high' ? 'enhanced' : 'standard',
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create business:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logger.info('Business registered:', business.id);

      return NextResponse.json({
        object: 'business_customer',
        ...business,
        riskAssessment: {
          score: riskScore,
          level: riskLevel,
          blocked: blockCheck.blocked,
          blockReason: blockCheck.reason,
          requiresEdd: riskLevel === 'high' || blockCheck.blocked,
        },
      }, { status: 201 });
    } catch (error) {
      logger.error('[BUSINESS_REGISTER_POST]', error);
      return NextResponse.json(
        { error: 'Failed to register business' },
        { status: 500 }
      );
    }
  });
}
