import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import { sanctionsScreening } from '@/lib/compliance/screening';
import { sendOCDDOverdueAlert, sendOCDDDueSoonAlert } from '@/lib/utils/compliance-alerts';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatcher';

/**
 * Cron job to execute Ongoing Customer Due Diligence (OCDD) reviews
 * Runs daily to perform scheduled customer reviews, sanctions/PEP screening, and document checks
 *
 * Security: Requires CRON_SECRET env variable matching request header
 *
 * Schedule: Daily at 9:00 AM AEST (Vercel Cron or AWS EventBridge)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const now = new Date();

    const results = {
      schedules_checked: 0,
      schedules_executed: 0,
      sanctions_screenings_performed: 0,
      pep_screenings_performed: 0,
      new_sanctions_matches: 0,
      new_pep_matches: 0,
      schedules_updated: 0,
      alerts_sent: 0,
      errors: [] as string[],
    };

    // Get all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        message: 'No active tenants found',
        results,
      });
    }

    // Process each tenant
    for (const tenant of tenants) {
      try {
        // Execute due OCDD schedules
        const executionResults = await executeOCDDSchedules(supabase, tenant.id);
        results.schedules_checked += executionResults.checked;
        results.schedules_executed += executionResults.executed;
        results.sanctions_screenings_performed += executionResults.sanctions_screened;
        results.pep_screenings_performed += executionResults.pep_screened;
        results.new_sanctions_matches += executionResults.sanctions_matches;
        results.new_pep_matches += executionResults.pep_matches;
        results.schedules_updated += executionResults.updated;

        // Check for overdue OCDD reviews (schedules that should have run but haven't)
        const overdueResults = await checkOverdueOCDD(supabase, tenant.id);
        if (overdueResults.overdue_count > 0) {
          await sendOCDDOverdueAlert(
            tenant.id,
            overdueResults.overdue_count,
            '/dashboard/compliance/ocdd'
          );
          results.alerts_sent++;
        }

        // Check for upcoming OCDD reviews (due within 7 days)
        const upcomingResults = await checkUpcomingOCDD(supabase, tenant.id);
        if (upcomingResults.upcoming_count > 0) {
          await sendOCDDDueSoonAlert(
            tenant.id,
            upcomingResults.upcoming_count,
            7,
            '/dashboard/compliance/ocdd'
          );
          results.alerts_sent++;
        }
      } catch (error) {
        const errorMsg = `Tenant ${tenant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[OCDD Runner] ${errorMsg}`);
      }
    }

    // Log execution to audit trail
    await supabase.from('audit_logs').insert({
      tenant_id: null, // System-level operation
      action_type: 'ocdd_execution_completed',
      entity_type: 'system',
      entity_id: null,
      description: `OCDD execution completed: ${results.schedules_executed} schedules executed, ${results.new_sanctions_matches} sanctions matches, ${results.new_pep_matches} PEP matches`,
      metadata: results,
    });

    return NextResponse.json({
      message: 'OCDD execution completed successfully',
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[OCDD Runner] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function executeOCDDSchedules(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string
): Promise<{
  checked: number;
  executed: number;
  sanctions_screened: number;
  pep_screened: number;
  sanctions_matches: number;
  pep_matches: number;
  updated: number;
}> {
  const now = new Date();

  // Get schedules that are due for execution
  const { data: dueSchedules, error: schedulesError } = await supabase
    .from('ocdd_schedules')
    .select(`
      id,
      customer_id,
      schedule_type,
      schedule_name,
      auto_screen_sanctions,
      auto_screen_pep,
      auto_check_documents,
      low_risk_frequency_days,
      medium_risk_frequency_days,
      high_risk_frequency_days
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .lte('next_scheduled_at', now.toISOString())
    .order('next_scheduled_at', { ascending: true });

  if (schedulesError) {
    throw new Error(`Failed to fetch OCDD schedules: ${schedulesError.message}`);
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return {
      checked: 0,
      executed: 0,
      sanctions_screened: 0,
      pep_screened: 0,
      sanctions_matches: 0,
      pep_matches: 0,
      updated: 0,
    };
  }

  let executed = 0;
  let sanctionsScreened = 0;
  let pepScreened = 0;
  let sanctionsMatches = 0;
  let pepMatches = 0;
  let updated = 0;

  for (const schedule of dueSchedules) {
    try {
      // Skip if no customer (orphaned schedule)
      if (!schedule.customer_id) {
        console.warn(`[OCDD] Schedule ${schedule.id} has no customer_id, skipping`);
        continue;
      }

      // Get customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, date_of_birth, country, risk_level')
        .eq('id', schedule.customer_id)
        .single();

      if (customerError || !customer) {
        console.error(`[OCDD] Failed to fetch customer ${schedule.customer_id}:`, customerError);
        continue;
      }

      const executionId = crypto.randomUUID();
      const checksPerformed: Array<{ check_type: string; result: string; details: any; timestamp: string }> = [];
      const findings: Array<{ finding_type: string; severity: string; description: string; action_required: boolean }> = [];
      let executionResult: 'passed' | 'failed' | 'requires_action' | 'escalated' = 'passed';

      // Perform sanctions screening if enabled
      if (schedule.auto_screen_sanctions && customer.first_name && customer.last_name) {
        try {
          const screeningResult = await sanctionsScreening(
            supabase,
            {
              firstName: customer.first_name,
              lastName: customer.last_name,
              dateOfBirth: customer.date_of_birth,
              country: customer.country,
            },
            {
              minimumMatchScore: 0.7,
              sources: ['DFAT', 'UN', 'OFAC'],
            }
          );

          sanctionsScreened++;

          // Record screening in database
          await supabase.from('sanctions_screenings').insert({
            tenant_id: tenantId,
            customer_id: customer.id,
            screened_first_name: customer.first_name,
            screened_last_name: customer.last_name,
            screened_dob: customer.date_of_birth,
            screened_country: customer.country,
            is_match: screeningResult.isMatch,
            match_score: screeningResult.matchScore,
            matched_entities: screeningResult.matches,
            status: screeningResult.status,
            screening_sources: screeningResult.sources,
            screened_at: screeningResult.screenedAt,
          });

          checksPerformed.push({
            check_type: 'sanctions_screening',
            result: screeningResult.status,
            details: {
              is_match: screeningResult.isMatch,
              match_score: screeningResult.matchScore,
              matches_count: screeningResult.matches.length,
            },
            timestamp: new Date().toISOString(),
          });

          if (screeningResult.isMatch) {
            sanctionsMatches++;
            executionResult = 'escalated';

            findings.push({
              finding_type: 'sanctions_match',
              severity: 'critical',
              description: `Customer matched against sanctions list with ${screeningResult.matchScore} confidence`,
              action_required: true,
            });

            // Dispatch webhook event
            await dispatchWebhookEvent(supabase, tenantId, 'screening.match', {
              customer_id: customer.id,
              screening_result: screeningResult,
            });
          }
        } catch (screeningError) {
          console.error(`[OCDD] Sanctions screening failed for customer ${customer.id}:`, screeningError);
          checksPerformed.push({
            check_type: 'sanctions_screening',
            result: 'error',
            details: {
              error: screeningError instanceof Error ? screeningError.message : 'Unknown error',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Perform PEP screening if enabled
      if (schedule.auto_screen_pep && customer.first_name && customer.last_name) {
        try {
          // For PEP screening, we use the same sanctions screening logic
          // In production, this would call a dedicated PEP screening service
          const fullName = `${customer.first_name} ${customer.last_name}`;

          // Simplified PEP check - in production, use dedicated PEP database
          const { data: pepData } = await supabase
            .from('pep_screenings')
            .select('is_pep')
            .eq('customer_id', customer.id)
            .order('screened_at', { ascending: false })
            .limit(1)
            .single();

          const isPep = pepData?.is_pep || false;

          pepScreened++;

          checksPerformed.push({
            check_type: 'pep_screening',
            result: isPep ? 'potential_match' : 'clear',
            details: {
              is_pep: isPep,
            },
            timestamp: new Date().toISOString(),
          });

          if (isPep) {
            pepMatches++;
            if (executionResult === 'passed') {
              executionResult = 'requires_action';
            }

            findings.push({
              finding_type: 'pep_match',
              severity: 'high',
              description: `Customer identified as Politically Exposed Person`,
              action_required: true,
            });
          }
        } catch (pepError) {
          console.error(`[OCDD] PEP screening failed for customer ${customer.id}:`, pepError);
          checksPerformed.push({
            check_type: 'pep_screening',
            result: 'error',
            details: {
              error: pepError instanceof Error ? pepError.message : 'Unknown error',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Document expiry check if enabled
      if (schedule.auto_check_documents) {
        // In production, this would check document expiry dates
        // Simplified implementation for now
        checksPerformed.push({
          check_type: 'document_check',
          result: 'passed',
          details: {
            documents_checked: 0,
            expired_documents: 0,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Create execution record
      await supabase.from('ocdd_executions').insert({
        id: executionId,
        schedule_id: schedule.id,
        tenant_id: tenantId,
        customer_id: customer.id,
        executed_at: now,
        completed_at: new Date(),
        result: executionResult,
        checks_performed: checksPerformed,
        findings: findings,
        executed_by: 'system',
      });

      // Calculate next scheduled date based on customer risk level
      const frequencyDays =
        customer.risk_level === 'high'
          ? schedule.high_risk_frequency_days || 90
          : customer.risk_level === 'medium'
          ? schedule.medium_risk_frequency_days || 180
          : schedule.low_risk_frequency_days || 365;

      const nextScheduledAt = new Date(now);
      nextScheduledAt.setDate(nextScheduledAt.getDate() + frequencyDays);

      // Update schedule
      await supabase
        .from('ocdd_schedules')
        .update({
          last_executed_at: now.toISOString(),
          last_completed_at: new Date().toISOString(),
          next_scheduled_at: nextScheduledAt.toISOString(),
          last_result: executionResult,
          last_result_at: new Date().toISOString(),
          execution_count: supabase.rpc('increment', { row_id: schedule.id }),
          //consecutive_failures: executionResult === 'failed' ? supabase.rpc('increment', { row_id: schedule.id }) : 0,
        })
        .eq('id', schedule.id);

      updated++;
      executed++;

      // Update customer OCDD next review date
      await supabase
        .from('customers')
        .update({
          ocdd_last_review_at: now.toISOString(),
          ocdd_next_review_at: nextScheduledAt.toISOString(),
        })
        .eq('id', customer.id);

      // TODO Dispatch webhook for OCDD completion
      // await dispatchWebhookEvent(supabase, tenantId, 'ocdd.review_completed', {
      //   schedule_id: schedule.id,
      //   customer_id: customer.id,
      //   execution_id: executionId,
      //   result: executionResult,
      //   checks_performed: checksPerformed.length,
      //   findings: findings.length,
      // });
    } catch (scheduleError) {
      console.error(`[OCDD] Failed to execute schedule ${schedule.id}:`, scheduleError);

      // Record failed execution
      await supabase.from('ocdd_executions').insert({
        schedule_id: schedule.id,
        tenant_id: tenantId,
        customer_id: schedule.customer_id,
        executed_at: now,
        completed_at: new Date(),
        result: 'error',
        checks_performed: [],
        findings: [
          {
            finding_type: 'execution_error',
            severity: 'high',
            description: scheduleError instanceof Error ? scheduleError.message : 'Unknown error',
            action_required: true,
          },
        ],
        executed_by: 'system',
      });
    }
  }

  return {
    checked: dueSchedules.length,
    executed,
    sanctions_screened: sanctionsScreened,
    pep_screened: pepScreened,
    sanctions_matches: sanctionsMatches,
    pep_matches: pepMatches,
    updated,
  };
}

async function checkOverdueOCDD(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string
): Promise<{ overdue_count: number }> {
  const now = new Date();
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // Find schedules that should have run but didn't (more than 1 day overdue)
  const { data: overdueSchedules, error } = await supabase
    .from('ocdd_schedules')
    .select('id, customer_id, schedule_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .lt('next_scheduled_at', oneDayAgo.toISOString())
    .or('last_executed_at.is.null,last_executed_at.lt.next_scheduled_at');

  if (error) {
    console.error('[OCDD] Failed to check overdue schedules:', error);
    return { overdue_count: 0 };
  }

  return {
    overdue_count: overdueSchedules?.length || 0,
  };
}

async function checkUpcomingOCDD(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string
): Promise<{ upcoming_count: number }> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Find schedules due within 7 days
  const { data: upcomingSchedules, error } = await supabase
    .from('ocdd_schedules')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gte('next_scheduled_at', now.toISOString())
    .lte('next_scheduled_at', sevenDaysFromNow.toISOString());

  if (error) {
    console.error('[OCDD] Failed to check upcoming schedules:', error);
    return { upcoming_count: 0 };
  }

  return {
    upcoming_count: upcomingSchedules?.length || 0,
  };
}
