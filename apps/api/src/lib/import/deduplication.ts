import { SupabaseClient } from '@supabase/supabase-js';
import { TransactionRow } from './csv-parser';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateId?: string;
  matchMethod?: 'external_id' | 'amount_date_customer' | 'exact_match';
  existingTransaction?: {
    id: string;
    amount: number;
    currency: string;
    created_at: string;
  };
}

/**
 * Check if a transaction is a duplicate
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
  row: TransactionRow
): Promise<DuplicateCheckResult> {
  // Strategy 1: Match by external transaction ID
  if (row.externalTransactionId) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('id, amount, currency, created_at')
      .eq('tenant_id', tenantId)
      .eq('external_id', row.externalTransactionId)
      .maybeSingle();

    if (existing) {
      return {
        isDuplicate: true,
        duplicateId: existing.id,
        matchMethod: 'external_id',
        existingTransaction: {
          id: existing.id,
          amount: existing.amount,
          currency: existing.currency,
          created_at: existing.created_at,
        },
      };
    }
  }

  // Strategy 2: Match by customer + amount + date (within 1 hour)
  const transactionDate = new Date(row.transactionDate);
  const startTime = new Date(transactionDate.getTime() - 60 * 60 * 1000); // 1 hour before
  const endTime = new Date(transactionDate.getTime() + 60 * 60 * 1000); // 1 hour after

  const { data: nearMatches } = await supabase
    .from('transactions')
    .select('id, amount, currency, direction, created_at')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('amount', row.amount)
    .eq('currency', row.currency)
    .eq('direction', row.direction)
    .gte('created_at', startTime.toISOString())
    .lte('created_at', endTime.toISOString())
    .limit(1);

  if (nearMatches && nearMatches.length > 0) {
    const match = nearMatches[0];
    return {
      isDuplicate: true,
      duplicateId: match.id,
      matchMethod: 'amount_date_customer',
      existingTransaction: {
        id: match.id,
        amount: match.amount,
        currency: match.currency,
        created_at: match.created_at,
      },
    };
  }

  return {
    isDuplicate: false,
  };
}

/**
 * Batch check duplicates for multiple transactions
 */
export async function batchCheckDuplicates(
  supabase: SupabaseClient,
  tenantId: string,
  rows: Array<{ customerId: string; row: TransactionRow; index: number }>
): Promise<Map<number, DuplicateCheckResult>> {
  const results = new Map<number, DuplicateCheckResult>();

  // Process in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(({ customerId, row, index }) =>
      checkDuplicate(supabase, tenantId, customerId, row).then((result) => ({
        index,
        result,
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    for (const { index, result } of batchResults) {
      results.set(index, result);
    }
  }

  return results;
}
