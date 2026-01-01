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

// PATCH /v1/transactions/:id - Update transaction
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const body = await request.json();
      const supabase = getServiceClient();

      const transactionId = extractTransactionId(id);

      // Check if transaction exists
      const { data: existing, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${transactionId},external_id.eq.${id}`)
        .single();

      if (fetchError || !existing) {
        return createNotFoundError('Transaction');
      }

      const updates: Record<string, unknown> = {};

      if (body.externalId !== undefined) updates.external_id = body.externalId;
      if (body.description !== undefined) updates.description = body.description;
      if (body.reviewStatus !== undefined) updates.review_status = body.reviewStatus;
      if (body.flaggedForReview !== undefined) updates.flagged_for_review = body.flaggedForReview;
      if (body.metadata !== undefined) updates.metadata = body.metadata;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        );
      }

      const { data: transaction, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update transaction:', error);
        return createInternalError('Failed to update transaction');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'transaction_updated',
        entity_type: 'transaction',
        entity_id: transaction.id,
        description: 'Transaction updated',
        metadata: { updates },
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json(formatTransaction(transaction));
    } catch (error) {
      console.error('Transaction update error:', error);
      return createInternalError('Failed to update transaction');
    }
  });
}

// DELETE /v1/transactions/:id - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = await params;
      const { tenant } = req;
      const supabase = getServiceClient();

      const transactionId = extractTransactionId(id);

      // Check if transaction exists
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .or(`id.eq.${transactionId},external_id.eq.${id}`)
        .single();

      if (fetchError || !transaction) {
        return createNotFoundError('Transaction');
      }

      // Delete transaction
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);

      if (error) {
        console.error('Failed to delete transaction:', error);
        return createInternalError('Failed to delete transaction');
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.tenantId,
        action_type: 'transaction_deleted',
        entity_type: 'transaction',
        entity_id: transaction.id,
        description: 'Transaction deleted',
        api_key_prefix: tenant.apiKeyPrefix,
      });

      return NextResponse.json({
        id: `txn_${transaction.id.slice(0, 8)}`,
        object: 'transaction',
        deleted: true,
      });
    } catch (error) {
      console.error('Transaction delete error:', error);
      return createInternalError('Failed to delete transaction');
    }
  });
}
