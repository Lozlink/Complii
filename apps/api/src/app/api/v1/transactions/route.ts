import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { getTenantConfig } from '@/lib/config/regions';
import { getComplianceRequirements, generateTTRReference } from '@/lib/compliance/thresholds';
import { detectStructuring, getStructuringConfigFromRegion } from '@/lib/compliance/structuring-detection';
import { calculateRiskScore, RiskContext } from '@/lib/compliance/risk-scoring';
import { createAlert, AlertGenerators } from '@/lib/alerts/alert-service';
import { createValidationError, createInternalError, createNotFoundError } from '@/lib/utils/errors';
import {
  dispatchTransactionCreated,
  dispatchTransactionFlagged,
  dispatchTransactionTtrRequired,
} from '@/lib/webhooks/dispatcher';
import { convertCurrency } from '@/lib/utils/currency';

interface TransactionCreateBody {
  customerId: string;
  externalId?: string;
  amount: number;
  currency?: string;
  direction: 'incoming' | 'outgoing';
  type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

function formatTransaction(tx: Record<string, unknown>) {
  return {
    id: `txn_${(tx.id as string)}`,
    object: 'transaction',
    customerId: `cus_${(tx.customer_id as string)}`,
    externalId: tx.external_id,
    amount: tx.amount,
    currency: tx.currency,
    amountLocal: tx.amount_local,
    direction: tx.direction,
    type: tx.transaction_type,
    description: tx.description,
    requiresTtr: tx.requires_ttr,
    ttrGeneratedAt: tx.ttr_generated_at,
    ttrReference: tx.ttr_reference,
    riskScore: tx.risk_score,
    riskLevel: tx.risk_level,
    riskFactors: tx.risk_factors,
    flaggedForReview: tx.flagged_for_review,
    reviewStatus: tx.review_status,
    metadata: tx.metadata,
    createdAt: tx.created_at,
    ttrSubmissionDeadline: tx.ttr_submission_deadline,
    ttrSubmissionStatus: tx.ttr_submission_status,

  };
}

function extractCustomerId(idParam: string): string {
  return idParam.startsWith('cus_') ? idParam.slice(4) : idParam;
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body: TransactionCreateBody = await req.json();

      if (!body.customerId) {
        return createValidationError('customerId', 'customerId is required');
      }
      if (body.amount === undefined || body.amount <= 0) {
        return createValidationError('amount', 'amount must be a positive number');
      }
      if (!body.direction || !['incoming', 'outgoing'].includes(body.direction)) {
        return createValidationError('direction', 'direction must be incoming or outgoing');
      }

      const { tenant } = req;
      const supabase = getServiceClient();
      const config = getTenantConfig(tenant.region, tenant.settings);

      const customerId = extractCustomerId(body.customerId);

      // Verify customer exists and belongs to tenant
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${customerId},external_id.eq.${body.customerId}`)
        .single();

      if (customerError || !customer) {
        return createNotFoundError('Customer');
      }

      // Get compliance requirements
      const compliance = await getComplianceRequirements(
        supabase,
        tenant.tenantId,
        customer.id,
        body.amount,
        config
      );

      // Check for structuring
      const structuringConfig = getStructuringConfigFromRegion(config);
      const structuringResult = await detectStructuring(
        supabase,
        tenant.tenantId,
        customer.id,
        body.amount,
        structuringConfig
      );

      // Calculate customer age in days
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

      // Check if customer is under EDD investigation
      const customerRequiresEDD = customer.requires_edd || false;

      // Calculate risk score
      const riskContext: RiskContext = {
        transactionAmount: body.amount,
        transactionCurrency: body.currency || config.currency,
        customerAgeDays,
        recentTransactionCount: recentTxCount || 0,
        hasUnusualPattern: structuringResult.isStructuring,
        customerRequiresEDD,
        customer: {
          isPep: customer.is_pep,
          isSanctioned: customer.is_sanctioned,
          verificationStatus: customer.verification_status,
        },
        thresholds: config.thresholds,
      };

      const riskResult = calculateRiskScore(riskContext);

      // Determine if TTR required and generate reference
      const requiresTtr = compliance.requiresTTR;
      let ttrReference: string | null = null;

      // Currency conversion to local currency
      const transactionCurrency = body.currency || config.currency;
      let amountLocal = body.amount;

      if (transactionCurrency !== config.currency) {
        try {
          amountLocal = convertCurrency(body.amount, transactionCurrency, config.currency);
        } catch (error) {
          console.error('Currency conversion error:', error);
          // Fall back to original amount if conversion fails
          amountLocal = body.amount;
        }
      }

      // Flag transaction if:
      // 1. High risk OR
      // 2. Structuring detected OR
      // 3. Customer is under EDD investigation
      const flaggedForReview =
        riskResult.riskLevel === 'high' ||
        structuringResult.isStructuring ||
        customerRequiresEDD;

      // Create transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          tenant_id: tenant.tenantId,
          customer_id: customer.id,
          external_id: body.externalId,
          amount: body.amount,
          currency: transactionCurrency,
          amount_local: amountLocal,
          direction: body.direction,
          transaction_type: body.type,
          description: body.description,
          requires_ttr: requiresTtr,
          risk_score: riskResult.riskScore,
          risk_level: riskResult.riskLevel,
          risk_factors: riskResult.factors,
          flagged_for_review: flaggedForReview,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (txError) {
        console.error('Transaction create error:', txError);
        return createInternalError('Failed to create transaction');
      }

      // Generate TTR reference if required
      if (requiresTtr) {
        ttrReference = generateTTRReference(transaction.id);
        await supabase
          .from('transactions')
          .update({
            ttr_reference: ttrReference,
            ttr_generated_at: new Date().toISOString(),
          })
          .eq('id', transaction.id);
        transaction.ttr_reference = ttrReference;
        transaction.ttr_generated_at = new Date().toISOString();
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'transaction_created',
        entity_type: 'transaction',
        entity_id: transaction.id,
        description: `Created ${body.direction} transaction of ${body.amount} ${body.currency || config.currency}`,
        metadata: {
          amount: body.amount,
          requiresTtr,
          riskLevel: riskResult.riskLevel,
          structuringDetected: structuringResult.isStructuring,
        },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      // If flagged due to EDD only, add audit trail
      if (customerRequiresEDD && !structuringResult.isStructuring && riskResult.riskLevel !== 'high') {
        await supabase.from('audit_logs').insert({
          tenant_id: tenant.tenantId,
          action_type: 'flagged_for_edd',
          entity_type: 'transaction',
          entity_id: transaction.id,
          description: 'Transaction auto-flagged due to customer EDD investigation',
          metadata: {
            customer_requires_edd: true,
            transaction_amount: body.amount,
          },
          api_key_prefix: tenant.apiKeyPrefix,
        });
      }

      // ===== Synchronous Alert Creation =====
      try {
        // 1. Structuring Detected Alert
        if (structuringResult.isStructuring) {
          await createAlert(
            supabase,
            AlertGenerators.structuringDetected(
              tenant.tenantId,
              customer.id,
              structuringResult.suspiciousTransactionCount,
              structuringResult.totalAmount,
              structuringResult.indicators
            )
          );
        }

        // 2. High Risk Transaction Alert
        if (riskResult.riskLevel === 'high') {
          await createAlert(
            supabase,
            AlertGenerators.highRiskScore(
              tenant.tenantId,
              'transaction',
              transaction.id,
              customer.id,
              riskResult.riskScore,
              riskResult.riskLevel,
              riskResult.factors
            )
          );
        }

        // 3. TTR Threshold Alert
        if (requiresTtr) {
          await createAlert(
            supabase,
            AlertGenerators.ttrThreshold(
              tenant.tenantId,
              transaction.id,
              customer.id,
              body.amount,
              body.currency || config.currency
            )
          );
        }

        // 4. Customer EDD Alert (if transaction flagged due to EDD)
        if (customerRequiresEDD && !structuringResult.isStructuring && riskResult.riskLevel !== 'high') {
          await createAlert(supabase, {
            tenantId: tenant.tenantId,
            ruleCode: 'CUSTOMER_EDD_TRANSACTION',
            entityType: 'transaction',
            entityId: transaction.id,
            customerId: customer.id,
            severity: 'medium',
            title: 'Transaction from Customer Under EDD',
            description: `Customer is under Enhanced Due Diligence investigation. All transactions flagged for review during investigation period.`,
            triggerData: {
              customer_requires_edd: true,
              transaction_amount: body.amount,
              customer_id: customer.id,
            },
          });
        }
      } catch (alertError) {
        // Log alert creation failures but don't block transaction creation
        console.error('Failed to create alerts:', alertError);
      }

      // ===== Dispatch Webhooks (for external systems) =====
      const formattedTx = formatTransaction(transaction);
      dispatchTransactionCreated(supabase, tenant.tenantId, formattedTx);

      if (transaction.flagged_for_review) {
        dispatchTransactionFlagged(supabase, tenant.tenantId, formattedTx);
      }

      if (requiresTtr) {
        dispatchTransactionTtrRequired(supabase, tenant.tenantId, formattedTx);
      }

      return NextResponse.json(formattedTx, { status: 201 });
    } catch (error) {
      console.error('Transaction create error:', error);
      return createInternalError('Failed to create transaction');
    }
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(req.url);

      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
      const startingAfter = searchParams.get('starting_after');
      const customerId = searchParams.get('customer_id');
      const flaggedForReview = searchParams.get('flagged_for_review');
      const requiresTtr = searchParams.get('requires_ttr');

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (startingAfter) {
        query = query.lt('id', startingAfter);
      }

      if (customerId) {
        const cid = extractCustomerId(customerId);
        query = query.eq('customer_id', cid);
      }

      if (flaggedForReview !== null) {
        query = query.eq('flagged_for_review', flaggedForReview === 'true');
      }

      if (requiresTtr !== null) {
        query = query.eq('requires_ttr', requiresTtr === 'true');
      }

      const { data: transactions, error, count } = await query;

      if (error) {
        console.error('Transaction list error:', error);
        return createInternalError('Failed to list transactions');
      }

      const hasMore = transactions && transactions.length > limit;
      const data = (transactions || []).slice(0, limit);

      return NextResponse.json({
        object: 'list',
        data: data.map(formatTransaction),
        hasMore,
        totalCount: count,
      });
    } catch (error) {
      console.error('Transaction list error:', error);
      return createInternalError('Failed to list transactions');
    }
  });
}
