import { SupabaseClient } from '@supabase/supabase-js';

export interface TTRReportData {
  reportId: string;
  tenantName: string;
  reportingPeriod: {
    start: string;
    end: string;
  };
  transactions: Array<{
    id: string;
    reference: string;
    customerId: string;
    customerName: string;
    amount: number;
    currency: string;
    date: string;
    description?: string;
  }>;
  totalAmount: number;
  transactionCount: number;
}

export async function generateTTRReportData(
  supabase: SupabaseClient,
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<TTRReportData> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  // Get tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  // Get TTR transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      ttr_reference,
      customer_id,
      amount,
      currency,
      created_at,
      description,
      customers (
        first_name,
        last_name,
        email
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('requires_ttr', true)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });

  const reportData: TTRReportData = {
    reportId: `TTR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 10)}`,
    tenantName: tenant?.name || 'Unknown',
    reportingPeriod: {
      start,
      end,
    },
    transactions: (transactions || []).map((tx) => ({
      id: tx.id,
      reference: tx.ttr_reference || '',
      customerId: tx.customer_id,
      customerName: tx.customers
        ? `${(tx.customers as unknown as Record<string, string>).first_name || ''} ${(tx.customers as unknown as Record<string, string>).last_name || ''}`.trim()
        : 'Unknown',
      amount: parseFloat(tx.amount.toString()),
      currency: tx.currency,
      date: tx.created_at,
      description: tx.description,
    })),
    totalAmount: (transactions || []).reduce(
      (sum, tx) => sum + parseFloat(tx.amount.toString()),
      0
    ),
    transactionCount: (transactions || []).length,
  };

  return reportData;
}

export function generateTTRReportCSV(data: TTRReportData): string {
  const lines = [
    `Transaction Threshold Report (TTR)`,
    `Report ID: ${data.reportId}`,
    `Tenant: ${data.tenantName}`,
    `Period: ${data.reportingPeriod.start} to ${data.reportingPeriod.end}`,
    `Total Transactions: ${data.transactionCount}`,
    `Total Amount: ${data.totalAmount}`,
    '',
    'Reference,Customer,Amount,Currency,Date,Description',
    ...data.transactions.map(
      (tx) =>
        `"${tx.reference}","${tx.customerName}",${tx.amount},"${tx.currency}","${tx.date}","${tx.description || ''}"`
    ),
  ];
  return lines.join('\n');
}

export function generateTTRReportJSON(data: TTRReportData): string {
  return JSON.stringify(data, null, 2);
}
