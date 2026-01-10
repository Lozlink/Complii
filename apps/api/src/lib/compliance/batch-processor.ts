import { SupabaseClient } from '@supabase/supabase-js';
import { sanctionsScreening, ScreeningConfig } from './screening';
import { calculateRiskScore, RiskContext } from './risk-scoring';
import {
  detectStructuring,
  getStructuringConfigFromRegion,
} from './structuring-detection';
import { getTenantConfig } from '../config/regions';
import { generateSMRReport } from '../reports/smr-generator';
import { createEDDInvestigation } from './edd-service';
import {
  dispatchScreeningMatch,
  dispatchRiskHigh,
  dispatchTransactionTtrRequired,
  dispatchAlertCreated,
} from '../webhooks/dispatcher';

export interface BatchComplianceResult {
  transactionsProcessed: number;
  customersScreened: number;
  alerts: {
    created: number;
    failed: number;
  };
  sanctions: {
    matches: number;
    clear: number;
  };
  riskScores: {
    high: number;
    medium: number;
    low: number;
  };
  structuring: {
    detected: number;
  };
  smr: {
    generated: number;
  };
  edd: {
    triggered: number;
  };
  errors: string[];
}

/**
 * Runs comprehensive compliance checks on a batch of transactions
 * This should be called after batch transaction import
 */
export async function runBatchCompliance(
  supabase: SupabaseClient,
  tenantId: string,
  transactionIds: string[]
): Promise<BatchComplianceResult> {
  const result: BatchComplianceResult = {
    transactionsProcessed: 0,
    customersScreened: 0,
    alerts: { created: 0, failed: 0 },
    sanctions: { matches: 0, clear: 0 },
    riskScores: { high: 0, medium: 0, low: 0 },
    structuring: { detected: 0 },
    smr: { generated: 0 },
    edd: { triggered: 0 },
    errors: [],
  };

  try {
    // Get tenant config
    const { data: tenant } = await supabase
      .from('tenants')
      .select('region, settings')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const config = getTenantConfig(tenant.region, tenant.settings);

    // Get all transactions with customer data
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(
        `
        *,
        customer:customers(
          id,
          first_name,
          last_name,
          date_of_birth,
          created_at,
          is_pep,
          is_sanctioned,
          verification_status,
          risk_score,
          risk_level
        )
      `
      )
      .in('id', transactionIds)
      .eq('tenant_id', tenantId);

    if (txError || !transactions) {
      result.errors.push(`Failed to fetch transactions: ${txError?.message}`);
      return result;
    }

    // Group transactions by customer
    const customerTransactionMap = new Map<string, typeof transactions>();
    const uniqueCustomerIds = new Set<string>();

    for (const tx of transactions) {
      if (tx.customer_id) {
        uniqueCustomerIds.add(tx.customer_id);
        if (!customerTransactionMap.has(tx.customer_id)) {
          customerTransactionMap.set(tx.customer_id, []);
        }
        customerTransactionMap.get(tx.customer_id)!.push(tx);
      }
    }

    // Process each customer
    for (const [customerId, customerTxns] of customerTransactionMap) {
      try {
        const customer = customerTxns[0].customer;
        if (!customer) continue;

        // 1. SANCTIONS SCREENING (if not already done recently)
        const screeningConfig: ScreeningConfig = {
          minimumMatchScore: 0.7,
          sources: config.screeningSources,
        };

        const screeningResult = await sanctionsScreening(
          supabase,
          {
            firstName: customer.first_name,
            lastName: customer.last_name,
            dateOfBirth: customer.date_of_birth,
          },
          screeningConfig
        );

        result.customersScreened++;

        // Save screening result
        await supabase.from('sanctions_screenings').insert({
          tenant_id: tenantId,
          customer_id: customerId,
          screening_service: 'DFAT',
          match_score: screeningResult.matchScore,
          matched_entities: screeningResult.matches,
          status: screeningResult.status,
          screening_type: 'batch_import',
        });

        if (screeningResult.isMatch) {
          result.sanctions.matches++;

          // Update customer status
          await supabase
            .from('customers')
            .update({ is_sanctioned: true, risk_level: 'high' })
            .eq('id', customerId);

          // Dispatch webhook for sanctions match
          await dispatchScreeningMatch(supabase, tenantId, {
            customerId,
            customerName: `${customer.first_name} ${customer.last_name}`,
            matches: screeningResult.matches,
            matchScore: screeningResult.matchScore,
          }).catch((err) => {
            console.error('Failed to dispatch screening match webhook:', err);
          });

          // CREATE ALERT for sanctions match
          for (const match of screeningResult.matches) {
            await createAlertDirect(supabase, {
              tenantId,
              ruleCode: 'SANCTIONS_MATCH',
              title: `Sanctions match: ${customer.first_name} ${customer.last_name}`,
              description: `Customer matched against ${match.source} sanctions list: "${match.name}" (${(match.matchScore * 100).toFixed(0)}% confidence). Immediate review required.`,
              severity: 'critical',
              entityType: 'customer',
              entityId: customerId,
              customerId,
              triggerData: {
                matchScore: match.matchScore,
                matchedName: match.name,
                source: match.source,
                screeningType: 'batch_import',
              },
            });
            result.alerts.created++;
          }
        } else {
          result.sanctions.clear++;
        }

        // 2. RISK SCORING for each transaction
        for (const tx of customerTxns) {
          // Get recent transaction count
          const { count: recentTxCount } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', customerId)
            .eq('tenant_id', tenantId)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

          // Calculate customer age
          const customerAge =
            (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24);

          const riskContext: RiskContext = {
            transactionAmount: tx.amount_local || tx.amount,
            transactionCurrency: tx.currency,
            customerAgeDays: customerAge,
            recentTransactionCount: recentTxCount || 0,
            hasUnusualPattern: false, // TODO: implement pattern detection
            customerRequiresEDD: customer.requires_edd || false,
            customer: {
              isPep: customer.is_pep || false,
              isSanctioned: customer.is_sanctioned || false,
              verificationStatus: customer.verification_status || 'unverified',
            },
            thresholds: config.thresholds,
          };

          const riskResult = calculateRiskScore(riskContext);

          // Update transaction risk data
          await supabase
            .from('transactions')
            .update({
              risk_score: riskResult.riskScore,
              risk_level: riskResult.riskLevel,
              metadata: {
                ...tx.metadata,
                risk_factors: riskResult.factors,
              },
            })
            .eq('id', tx.id);

          result.riskScores[riskResult.riskLevel]++;

          // CREATE ALERT for high risk
          if (riskResult.riskLevel === 'high') {
            // Dispatch webhook for high risk
            await dispatchRiskHigh(supabase, tenantId, {
              transactionId: tx.id,
              customerId,
              riskScore: riskResult.riskScore,
              riskLevel: riskResult.riskLevel,
              factors: riskResult.factors,
            }).catch((err) => {
              console.error('Failed to dispatch risk high webhook:', err);
            });

            await createAlertDirect(supabase, {
              tenantId,
              ruleCode: 'HIGH_RISK_TRANSACTION',
              title: `High risk transaction detected (score: ${riskResult.riskScore})`,
              description: `Transaction flagged as high risk. Key factors: ${riskResult.factors.map(f => f.reason).slice(0, 3).join('; ')}`,
              severity: riskResult.riskScore >= 80 ? 'critical' : 'high',
              entityType: 'transaction',
              entityId: tx.id,
              customerId,
              triggerData: {
                riskScore: riskResult.riskScore,
                riskLevel: riskResult.riskLevel,
                factors: riskResult.factors,
              },
            });
            result.alerts.created++;
          }

          // CREATE ALERT for TTR threshold
          if (tx.requires_ttr) {
            // Dispatch webhook for TTR requirement
            await dispatchTransactionTtrRequired(supabase, tenantId, {
              transactionId: tx.id,
              customerId,
              amount: tx.amount,
              currency: tx.currency,
              ttrReference: tx.ttr_reference,
            }).catch((err) => {
              console.error('Failed to dispatch TTR required webhook:', err);
            });

            await createAlertDirect(supabase, {
              tenantId,
              ruleCode: 'TXN_TTR_THRESHOLD',
              title: `Transaction requires TTR (${tx.currency} ${tx.amount.toLocaleString()})`,
              description: `Transaction amount meets or exceeds TTR reporting threshold. TTR must be submitted within 10 business days.`,
              severity: 'high',
              entityType: 'transaction',
              entityId: tx.id,
              customerId,
              triggerData: {
                amount: tx.amount,
                currency: tx.currency,
                threshold: 'ttr',
              },
            });
            result.alerts.created++;
          }

          result.transactionsProcessed++;
        }

        // 3. STRUCTURING DETECTION
        const structuringConfig = getStructuringConfigFromRegion(config);
        const currentTx = customerTxns[0]; // Check against most recent

        const structuringResult = await detectStructuring(
          supabase,
          tenantId,
          customerId,
          currentTx.amount_local || currentTx.amount,
          structuringConfig
        );

        if (structuringResult.isStructuring) {
          result.structuring.detected++;

          // CREATE ALERT for structuring
          await createAlertDirect(supabase, {
            tenantId,
            ruleCode: 'STRUCTURING_DETECTED',
            title: `Potential structuring activity detected`,
            description: `Customer has ${structuringResult.suspiciousTransactionCount} suspicious transactions totaling ${structuringResult.totalAmount.toLocaleString()}. Indicators: ${structuringResult.indicators.join('; ')}. SMR may be required.`,
            severity: 'critical',
            entityType: 'customer',
            entityId: customerId,
            customerId,
            triggerData: {
              transactionCount: structuringResult.suspiciousTransactionCount,
              totalAmount: structuringResult.totalAmount,
              indicators: structuringResult.indicators,
            },
          });
          result.alerts.created++;

          // AUTO-GENERATE SMR for structuring
          try {
            await generateSMRReport(supabase, tenantId, config, {
              activityType: 'money_laundering',
              description: `Potential structuring detected: ${structuringResult.indicators.join('; ')}`,
              suspicionFormedDate: new Date().toISOString(),
              customerId,
              transactionIds: customerTxns.map(tx => tx.id),
              suspicionGrounds: `Customer engaged in ${structuringResult.suspiciousTransactionCount} transactions just below reporting threshold over ${structuringConfig.windowDays} days, totaling ${structuringResult.totalAmount.toLocaleString()}. ${structuringResult.indicators.join(' ')}`,
              actionTaken: 'SMR automatically generated. Customer flagged for EDD investigation.',
              reportingOfficer: {
                name: 'Compliance System',
                position: 'Automated Compliance Monitoring',
                contactNumber: 'N/A',
              },
            });
            result.smr.generated++;
          } catch (smrError) {
            result.errors.push(
              `Failed to generate SMR for customer ${customerId}: ${smrError instanceof Error ? smrError.message : 'Unknown error'}`
            );
          }
        }

        // 4. EDD TRIGGERING (for high-risk customers or large transactions)
        const shouldTriggerEDD =
          customer.risk_level === 'high' ||
          customer.is_sanctioned ||
          (customer.is_pep && customerTxns.some(tx => tx.amount_Local >= config.thresholds.enhancedDdRequired)) ||
          customerTxns.some(tx => tx.amount_local >= config.thresholds.enhancedDdRequired);

        if (shouldTriggerEDD && !customer.requires_edd) {
          try {
            const eddResult = await createEDDInvestigation(supabase, tenantId, {
              customerId,
              transactionId: customerTxns[0].id,
              triggerReason: `Automatic: High-risk profile detected during batch import (risk level: ${customer.risk_level}, PEP: ${customer.is_pep}, Sanctioned: ${customer.is_sanctioned})`,
              triggeredBy: 'system',
            });

            if (eddResult.success) {
              result.edd.triggered++;

              // CREATE ALERT for EDD
              await createAlertDirect(supabase, {
                tenantId,
                ruleCode: 'EDD_TRIGGERED',
                title: `EDD investigation ${eddResult.investigation?.investigation_number} opened`,
                description: `Enhanced Due Diligence investigation triggered: ${eddResult.investigation?.trigger_reason}. Customer information must be collected and reviewed.`,
                severity: 'high',
                entityType: 'customer',
                entityId: customerId,
                customerId,
                triggerData: {
                  investigationNumber: eddResult.investigation?.investigation_number,
                  triggerReason: eddResult.investigation?.trigger_reason,
                },
              });
              result.alerts.created++;
            }
          } catch (eddError) {
            result.errors.push(
              `Failed to trigger EDD for customer ${customerId}: ${eddError instanceof Error ? eddError.message : 'Unknown error'}`
            );
          }
        }
      } catch (customerError) {
        result.errors.push(
          `Error processing customer ${customerId}: ${customerError instanceof Error ? customerError.message : 'Unknown error'}`
        );
      }
    }

    // Log audit event for batch processing
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action_type: 'compliance.batch_processed',
      entity_type: 'transaction',
      description: `Batch compliance processing completed: ${result.transactionsProcessed} transactions, ${result.alerts.created} alerts created`,
      metadata: result,
    });

    return result;
  } catch (error) {
    result.errors.push(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Creates an alert if an enabled rule exists for this event
 * Respects alert_rules configuration and cooldown periods
 */
async function createAlertDirect(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    ruleCode: string;
    title: string;
    description: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    entityType: 'customer' | 'transaction' | 'document' | 'screening';
    entityId: string;
    customerId?: string;
    triggerData: Record<string, unknown>;
  }
) {
  try {
    console.log(`[Alert] Checking rule ${input.ruleCode} for tenant ${input.tenantId}`);

    // Get the alert rule for this event type
    const { data: rule, error: ruleError } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('rule_code', input.ruleCode)
      .eq('is_enabled', true)
      .maybeSingle();

    if (ruleError) {
      console.error(`[Alert] Error fetching rule ${input.ruleCode}:`, ruleError);
      return;
    }

    if (!rule) {
      console.log(`[Alert] No enabled rule found for ${input.ruleCode}, skipping alert`);
      return;
    }

    console.log(`[Alert] Found rule ${rule.rule_name} (${rule.id}), creating alert...`);

    // Check cooldown period
    if (rule.cooldown_minutes) {
      const cooldownStart = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
      const { data: recentAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .eq('alert_rule_id', rule.id)
        .eq('entity_type', input.entityType)
        .eq('entity_id', input.entityId)
        .gte('created_at', cooldownStart.toISOString())
        .maybeSingle();

      if (recentAlert) {
        return; // Skip - within cooldown period
      }
    }

    // Check daily rate limit
    if (rule.max_alerts_per_day) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', input.tenantId)
        .eq('alert_rule_id', rule.id)
        .gte('created_at', todayStart.toISOString());

      if (count && count >= rule.max_alerts_per_day) {
        return; // Skip - daily limit reached
      }
    }

    // Generate alert number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', input.tenantId)
      .gte('created_at', new Date().toISOString().slice(0, 10));

    const alertNumber = `ALT-${today}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Create alert
    const { data: alert } = await supabase
      .from('alerts')
      .insert({
        tenant_id: input.tenantId,
        alert_rule_id: rule.id,
        alert_number: alertNumber,
        title: input.title,
        description: input.description,
        severity: rule.severity || input.severity,
        entity_type: input.entityType,
        entity_id: input.entityId,
        customer_id: input.customerId || null,
        trigger_data: input.triggerData,
        status: 'new',
        metadata: {
          auto_created: true,
          source: 'batch_compliance_processor',
          rule_code: input.ruleCode,
        },
      })
      .select()
      .single();

    // Auto-create case if configured
    if (alert && rule.auto_create_case && rule.case_type) {
      await supabase.from('cases').insert({
        tenant_id: input.tenantId,
        case_type: rule.case_type,
        priority: rule.case_priority || 'medium',
        customer_id: input.customerId || null,
        title: `Case: ${input.title}`,
        description: input.description,
        status: 'open',
        metadata: {
          alert_id: alert.id,
          alert_number: alertNumber,
          triggered_by_rule: input.ruleCode,
        },
      });

      await supabase
        .from('alerts')
        .update({ case_id: alert.id, status: 'escalated' })
        .eq('id', alert.id);
    }

    // Dispatch webhook event for alert creation
    if (alert) {
      await dispatchAlertCreated(supabase, input.tenantId, alert).catch((err) => {
        console.error('Failed to dispatch alert webhook:', err);
      });
    }
  } catch (error) {
    console.error('Failed to create alert:', error);
    // Don't throw - alert creation failures shouldn't block compliance processing
  }
}
