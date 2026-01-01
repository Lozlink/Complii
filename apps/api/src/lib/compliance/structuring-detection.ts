import { SupabaseClient } from '@supabase/supabase-js';
import { RegionalConfig } from '../config/regions';

export interface StructuringConfig {
  windowDays: number;
  minTransactionCount: number;
  amountRange: {
    min: number;
    max: number;
  };
  ttrThreshold: number;
}

export interface StructuringResult {
  isStructuring: boolean;
  suspiciousTransactionCount: number;
  totalAmount: number;
  indicators: string[];
}

export async function detectStructuring(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
  currentAmount: number,
  config: StructuringConfig
): Promise<StructuringResult> {
  const { windowDays, minTransactionCount, amountRange, ttrThreshold } = config;

  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentTransactions, error } = await supabase
    .from('transactions')
    .select('amount, amount_local, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Structuring detection error:', error);
    return {
      isStructuring: false,
      suspiciousTransactionCount: 0,
      totalAmount: 0,
      indicators: [],
    };
  }

  if (!recentTransactions || recentTransactions.length === 0) {
    return {
      isStructuring: false,
      suspiciousTransactionCount: 0,
      totalAmount: currentAmount,
      indicators: [],
    };
  }

  // Find transactions in the suspicious amount range (just below threshold)
  const suspiciousTransactions = recentTransactions.filter((tx) => {
    const amount = tx.amount_local || tx.amount;
    return amount >= amountRange.min && amount < amountRange.max;
  });

  const totalRecent = recentTransactions.reduce((sum, tx) => {
    const amount = tx.amount_local || tx.amount;
    return sum + parseFloat(amount.toString());
  }, 0);

  const indicators: string[] = [];
  let isStructuring = false;

  // Pattern 1: Multiple transactions just below threshold
  if (suspiciousTransactions.length >= minTransactionCount) {
    isStructuring = true;
    indicators.push(
      `${suspiciousTransactions.length} transactions between $${amountRange.min.toLocaleString()}-$${amountRange.max.toLocaleString()} in ${windowDays} days`
    );
  }

  // Pattern 2: Cumulative amount exceeds threshold with suspicious transactions
  if (
    totalRecent + currentAmount >= ttrThreshold &&
    suspiciousTransactions.length >= 2
  ) {
    isStructuring = true;
    indicators.push(
      `Cumulative total $${(totalRecent + currentAmount).toLocaleString()} exceeds TTR threshold with ${suspiciousTransactions.length} suspicious transactions`
    );
  }

  // Pattern 3: Current transaction plus recent just under threshold
  if (
    currentAmount >= amountRange.min &&
    currentAmount < amountRange.max &&
    suspiciousTransactions.length >= 2
  ) {
    isStructuring = true;
    indicators.push(
      `Current transaction of $${currentAmount.toLocaleString()} continues pattern of threshold-adjacent amounts`
    );
  }

  return {
    isStructuring,
    suspiciousTransactionCount: suspiciousTransactions.length,
    totalAmount: totalRecent + currentAmount,
    indicators,
  };
}

export function getStructuringConfigFromRegion(
  regionalConfig: RegionalConfig
): StructuringConfig {
  return {
    windowDays: regionalConfig.thresholds.structuringWindow,
    minTransactionCount: regionalConfig.thresholds.structuringMinTxCount,
    amountRange: regionalConfig.thresholds.structuringAmountRange,
    ttrThreshold: regionalConfig.thresholds.ttrRequired,
  };
}
