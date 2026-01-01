import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { getServiceClient } from '@/lib/db/client';
import { createNotFoundError, createInternalError } from '@/lib/utils/errors';

function formatTransaction(tx: Record<string, unknown>) {
  return {
    id: `txn_${(tx.id as string).slice(0, 8)}`,
    object: 'transaction',
    customerId: `cus_${(tx.customer_id as string).slice(0, 8)}`,
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
    flaggedForReview: tx.flagged_for_review,
    reviewStatus: tx.review_status,
    metadata: tx.metadata,
    createdAt: tx.created_at,
  };
}

function extractTransactionId(idParam: string): string {
  if (idParam.startsWith('txn_')) {
    return idParam.slice(4);
  }
  return idParam;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const transactionId = extractTransactionId(id);

      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${transactionId},external_id.eq.${id}`)
        .single();

      if (error || !transaction) {
        return createNotFoundError('Transaction');
      }

      return NextResponse.json(formatTransaction(transaction));
    } catch (error) {
      console.error('Transaction get error:', error);
      return createInternalError('Failed to get transaction');
    }
  });
}
