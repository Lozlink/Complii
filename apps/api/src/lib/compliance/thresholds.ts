import { SupabaseClient } from '@supabase/supabase-js';
import { RegionalConfig } from '../config/regions';

export interface ComplianceRequirements {
  requiresEnhancedDD: boolean;
  requiresKYC: boolean;
  requiresTTR: boolean;
  cumulativeTotal: number;
  newCumulativeTotal: number;
  thresholds: {
    enhancedDD: number;
    kycRequired: number;
    ttrRequired: number;
  };
}

export async function getComplianceRequirements(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
  currentAmount: number,
  config: RegionalConfig
): Promise<ComplianceRequirements> {
  const thresholds = {
    enhancedDD: config.thresholds.enhancedDdRequired,
    kycRequired: config.thresholds.kycRequired,
    ttrRequired: config.thresholds.ttrRequired,
  };

  // Get customer's lifetime transaction total
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('amount, amount_local, currency')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);

  if (error) {
    console.error('Failed to fetch transactions for threshold check:', error);
    // Return conservative response on error
    return {
      requiresEnhancedDD: currentAmount >= thresholds.enhancedDD,
      requiresKYC: currentAmount >= thresholds.kycRequired,
      requiresTTR: currentAmount >= thresholds.ttrRequired,
      cumulativeTotal: 0,
      newCumulativeTotal: currentAmount,
      thresholds,
    };
  }

  const lifetimeTotal =
    transactions?.reduce((sum, tx) => {
      // Use local amount if available, otherwise use amount
      const amount = tx.amount_local ?? tx.amount;
      return sum + parseFloat(amount.toString());
    }, 0) || 0;

  const newCumulativeTotal = lifetimeTotal + currentAmount;

  return {
    requiresEnhancedDD: newCumulativeTotal >= thresholds.enhancedDD,
    requiresKYC: newCumulativeTotal >= thresholds.kycRequired,
    requiresTTR: currentAmount >= thresholds.ttrRequired,
    cumulativeTotal: lifetimeTotal,
    newCumulativeTotal,
    thresholds,
  };
}

export function generateTTRReference(transactionId: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const shortId = transactionId.slice(0, 8);
  return `TTR-${dateStr}-${shortId}`;
}
