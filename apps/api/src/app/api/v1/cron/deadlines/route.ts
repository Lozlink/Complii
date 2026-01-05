import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/db/client';
import { runAllTenantsDeadlineChecks } from '@/lib/compliance/deadline-checker';

/**
 * Cron endpoint to check for approaching TTR/SMR deadlines and send alerts.
 *
 * This endpoint iterates all active tenants and checks their pending
 * TTRs and SMRs for approaching deadlines.
 *
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/v1/cron/deadlines",
 *     "schedule": "0 21 * * *"  // 9 PM UTC = 8 AM AEST next day
 *   }]
 * }
 *
 * For external schedulers (AWS CloudWatch, etc.), call with:
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';

  // In production, require either CRON_SECRET or Vercel cron header
  if (process.env.NODE_ENV === 'production') {
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!hasValidSecret && !isVercelCron) {
      console.log('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('Running deadline checks via cron...');

  try {
    const supabase = getServiceClient();
    const result = await runAllTenantsDeadlineChecks(supabase);

    // Log summary
    await supabase.from('audit_logs').insert({
      action_type: 'cron_deadline_check',
      entity_type: 'system',
      description: `Cron deadline check: ${result.tenantsChecked} tenants, ${result.totalTtrAlerts} TTR alerts, ${result.totalSmrAlerts} SMR alerts`,
      metadata: {
        tenants_checked: result.tenantsChecked,
        ttr_alerts: result.totalTtrAlerts,
        smr_alerts: result.totalSmrAlerts,
        error_count: result.errors.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Deadline checks completed',
      tenantsChecked: result.tenantsChecked,
      ttrAlertsSent: result.totalTtrAlerts,
      smrAlertsSent: result.totalSmrAlerts,
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Deadline check cron failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility with external schedulers
export async function POST(req: NextRequest) {
  return GET(req);
}
