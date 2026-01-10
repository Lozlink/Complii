import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';

// GET /v1/analytics/overview - Get analytics overview
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { tenant } = req;
      const supabase = getServiceClient();
      const { searchParams } = new URL(request.url);

      const startDate =
        searchParams.get('startDate') ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = searchParams.get('endDate') || new Date().toISOString();

      // Get customer stats
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId);

      const { count: verifiedCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('verification_status', 'verified');

      const { count: sanctionedCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('is_sanctioned', true);

      const { count: pepCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('is_pep', true);

      const { count: businessCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('customer_type', 'business');

      const { count: pendingCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .in('verification_status', ['pending', 'submitted', 'in_review']);

      // Get transaction stats
      const { count: totalTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { data: transactionAmounts } = await supabase
        .from('transactions')
        .select('amount, currency')
        .eq('tenant_id', tenant.tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalAmount = (transactionAmounts || []).reduce(
        (sum, tx) => sum + parseFloat(tx.amount.toString()),
        0
      );

      const { count: ttrTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('requires_ttr', true)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { count: flaggedTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('flagged_for_review', true)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get screening stats
      const { count: totalScreenings } = await supabase
        .from('sanctions_screenings')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .gte('screened_at', startDate)
        .lte('screened_at', endDate);

      const { count: screeningMatches } = await supabase
        .from('sanctions_screenings')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('is_match', true)
        .gte('screened_at', startDate)
        .lte('screened_at', endDate);

      // Get risk distribution
      const { data: riskDistribution } = await supabase
        .from('customers')
        .select('risk_level')
        .eq('tenant_id', tenant.tenantId);

      const riskCounts = {
        low: 0,
        medium: 0,
        high: 0,
      };
      (riskDistribution || []).forEach((r) => {
        const level = r.risk_level as 'low' | 'medium' | 'high';
        if (level in riskCounts) riskCounts[level]++;
      });

      // Get alert stats
      const { count: openAlerts } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'open');

      const { count: criticalAlerts } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'open')
        .eq('severity', 'critical');

      // Get case stats
      const { count: openCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'open');

      const { count: pendingCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'pending');

      // Get OCDD stats
      const now = new Date();
      const oneWeekFromNow = new Date(now);
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

      const { count: ocddDueThisWeek } = await supabase
        .from('ocdd_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'active')
        .gte('next_scheduled_at', now.toISOString())
        .lte('next_scheduled_at', oneWeekFromNow.toISOString());

      const { count: ocddOverdue } = await supabase
        .from('ocdd_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'active')
        .lt('next_scheduled_at', now.toISOString());

      return NextResponse.json({
        object: 'analytics_overview',
        period: {
          start: startDate,
          end: endDate,
        },
        customers: {
          total: totalCustomers || 0,
          verified: verifiedCustomers || 0,
          pending: pendingCustomers || 0,
          sanctioned: sanctionedCustomers || 0,
          pep: pepCustomers || 0,
          business: businessCustomers || 0,
          verificationRate:
            (totalCustomers || 0) > 0
              ? Math.round(((verifiedCustomers || 0) / (totalCustomers || 0)) * 100)
              : 0,
        },
        transactions: {
          total: totalTransactions || 0,
          totalAmount: totalAmount,
          averageAmount:
            (totalTransactions || 0) > 0 ? totalAmount / (totalTransactions || 0) : 0,
          ttrRequired: ttrTransactions || 0,
          flaggedForReview: flaggedTransactions || 0,
        },
        screenings: {
          total: totalScreenings || 0,
          matches: screeningMatches || 0,
          matchRate:
            (totalScreenings || 0) > 0
              ? ((screeningMatches || 0) / (totalScreenings || 0)) * 100
              : 0,
        },
        riskDistribution: riskCounts,
        alerts: {
          open: openAlerts || 0,
          critical: criticalAlerts || 0,
        },
        cases: {
          open: openCases || 0,
          pending: pendingCases || 0,
        },
        ocdd: {
          dueThisWeek: ocddDueThisWeek || 0,
          overdue: ocddOverdue || 0,
        },
      });
    } catch (error) {
      console.error('Analytics overview error:', error);
      return NextResponse.json(
        { error: 'Failed to generate analytics' },
        { status: 500 }
      );
    }
  });
}
