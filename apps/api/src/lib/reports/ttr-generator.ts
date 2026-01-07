import { SupabaseClient } from '@supabase/supabase-js';
import { RegionalConfig } from '../config/regions';
import { calculateTTRDeadline, formatDeadline } from '../compliance/deadline-utils';

/**
 * Individual TTR Report Data - One report per transaction
 * Conforms to AUSTRAC reporting requirements
 */
export interface TTRReportData {
  // Report identification
  reportReference: string;
  reportType: 'TTR';
  reportVersion: string;

  // Reporting entity (the tenant/business)
  reportingEntity: {
    name: string;
    abn?: string;
    acn?: string;
  };

  // Transaction details
  transaction: {
    id: string;
    reference: string;
    date: string;
    amount: number;
    currency: string;
    amountAud: number;
    direction: 'incoming' | 'outgoing';
    type?: string;
    description?: string;
    method?: string; // cash, eft, crypto, etc.
  };

  // Customer details (party to transaction)
  customer: {
    id: string;
    type: 'individual' | 'business';
    // Individual
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    // Business
    companyName?: string;
    abn?: string;
    acn?: string;
    // Contact
    email?: string;
    phone?: string;
    // Address
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
    // Identification
    idType?: string;
    idNumber?: string;
    idCountry?: string;
  };

  // Compliance metadata
  submissionDeadline: string;
  generatedAt: string;
}

/**
 * Generate individual TTR report data for a single transaction
 */
export async function generateIndividualTTR(
  supabase: SupabaseClient,
  tenantId: string,
  transactionId: string,
  config: Pick<RegionalConfig, 'holidays' | 'workweek' | 'deadlines'>
): Promise<TTRReportData | null> {
  // Get transaction with customer details
  const { data: transaction, error } = await supabase
    .from('transactions')
    .select(`
      *,
      customers (
        id,
        customer_type,
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        company_name,
        abn,
        acn,
        email,
        phone,
        residential_address
      )
    `)
    .eq('id', transactionId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !transaction) {
    console.error('Failed to fetch transaction for TTR:', error);
    return null;
  }

  // Get tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single();

  const customer = transaction.customers as Record<string, unknown> | null;
  const address = customer?.residential_address as Record<string, string> | null;
  const tenantSettings = tenant?.settings as Record<string, unknown> | null;

  const transactionDate = new Date(transaction.created_at);
  const deadline = calculateTTRDeadline(transactionDate, config);

  const reportData: TTRReportData = {
    reportReference: transaction.ttr_reference || `TTR-${transaction.id.slice(0, 8)}`,
    reportType: 'TTR',
    reportVersion: '1.0',

    reportingEntity: {
      name: tenant?.name || 'Unknown',
      abn: (tenantSettings?.abn as string) || undefined,
      acn: (tenantSettings?.acn as string) || undefined,
    },

    transaction: {
      id: transaction.id,
      reference: transaction.external_id || transaction.id,
      date: transaction.created_at,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      amountAud: parseFloat(transaction.amount_local || transaction.amount),
      direction: transaction.direction,
      type: transaction.transaction_type,
      description: transaction.description,
      method: (transaction.metadata as Record<string, string>)?.method,
    },

    customer: {
      id: customer?.id as string || transaction.customer_id,
      type: (customer?.customer_type as 'individual' | 'business') || 'individual',
      firstName: customer?.first_name as string,
      middleName: customer?.middle_name as string,
      lastName: customer?.last_name as string,
      dateOfBirth: customer?.date_of_birth as string,
      companyName: customer?.company_name as string,
      abn: customer?.abn as string,
      acn: customer?.acn as string,
      email: customer?.email as string,
      phone: customer?.phone as string,
      address: address
        ? {
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postcode: address.postcode,
            country: address.country || 'AU',
          }
        : undefined,
    },

    submissionDeadline: deadline.toISOString(),
    generatedAt: new Date().toISOString(),
  };

  // Update transaction with generated report data
  await supabase
    .from('transactions')
    .update({
      ttr_generated_at: new Date().toISOString(),
      ttr_submission_status: 'ready',
      ttr_report_data: reportData,
      ttr_submission_deadline: deadline.toISOString(),
    })
    .eq('id', transactionId)
    .eq('tenant_id', tenantId);

  return reportData;
}

/**
 * Generate AUSTRAC-compliant XML for TTR submission
 */
export function generateTTRXml(data: TTRReportData): string {
  const escapeXml = (str: string | undefined): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const customerXml =
    data.customer.type === 'individual'
      ? `
    <Individual>
      <FirstName>${escapeXml(data.customer.firstName)}</FirstName>
      ${data.customer.middleName ? `<MiddleName>${escapeXml(data.customer.middleName)}</MiddleName>` : ''}
      <LastName>${escapeXml(data.customer.lastName)}</LastName>
      ${data.customer.dateOfBirth ? `<DateOfBirth>${data.customer.dateOfBirth}</DateOfBirth>` : ''}
    </Individual>`
      : `
    <Entity>
      <Name>${escapeXml(data.customer.companyName)}</Name>
      ${data.customer.abn ? `<ABN>${data.customer.abn}</ABN>` : ''}
      ${data.customer.acn ? `<ACN>${data.customer.acn}</ACN>` : ''}
    </Entity>`;

  const addressXml = data.customer.address
    ? `
    <Address>
      <Line1>${escapeXml(data.customer.address.line1)}</Line1>
      ${data.customer.address.line2 ? `<Line2>${escapeXml(data.customer.address.line2)}</Line2>` : ''}
      <City>${escapeXml(data.customer.address.city)}</City>
      <State>${escapeXml(data.customer.address.state)}</State>
      <Postcode>${escapeXml(data.customer.address.postcode)}</Postcode>
      <Country>${escapeXml(data.customer.address.country)}</Country>
    </Address>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<TTR xmlns="http://www.austrac.gov.au/ttr/1.0">
  <ReportReference>${escapeXml(data.reportReference)}</ReportReference>
  <ReportType>TTR</ReportType>
  <ReportVersion>${data.reportVersion}</ReportVersion>
  <GeneratedAt>${data.generatedAt}</GeneratedAt>

  <ReportingEntity>
    <Name>${escapeXml(data.reportingEntity.name)}</Name>
    ${data.reportingEntity.abn ? `<ABN>${data.reportingEntity.abn}</ABN>` : ''}
    ${data.reportingEntity.acn ? `<ACN>${data.reportingEntity.acn}</ACN>` : ''}
  </ReportingEntity>

  <Transaction>
    <Reference>${escapeXml(data.transaction.reference)}</Reference>
    <Date>${data.transaction.date}</Date>
    <Amount currency="${data.transaction.currency}">${data.transaction.amount}</Amount>
    <AmountAUD>${data.transaction.amountAud}</AmountAUD>
    <Direction>${data.transaction.direction}</Direction>
    ${data.transaction.type ? `<Type>${escapeXml(data.transaction.type)}</Type>` : ''}
    ${data.transaction.description ? `<Description>${escapeXml(data.transaction.description)}</Description>` : ''}
    ${data.transaction.method ? `<Method>${escapeXml(data.transaction.method)}</Method>` : ''}
  </Transaction>

  <PartyToTransaction>
    <Type>${data.customer.type}</Type>
    ${customerXml}
    ${addressXml}
    ${data.customer.email ? `<Email>${escapeXml(data.customer.email)}</Email>` : ''}
    ${data.customer.phone ? `<Phone>${escapeXml(data.customer.phone)}</Phone>` : ''}
  </PartyToTransaction>

  <SubmissionDeadline>${data.submissionDeadline}</SubmissionDeadline>
</TTR>`;
}

/**
 * List transactions requiring TTR that haven't been submitted yet
 */
export async function listPendingTTRs(
  supabase: SupabaseClient,
  tenantId: string,
  options: {
    limit?: number;
    includeOverdue?: boolean;
    status?: string;
  } = {}
): Promise<{
  transactions: Array<{
    id: string;
    ttr_reference: string;
    amount: number;
    currency: string;
    customer_id: string;
    created_at: string;
    ttr_submission_deadline: string | null;
    ttr_submission_status: string;
    days_until_deadline: number | null;
    is_overdue: boolean;
  }>;
  total: number;
  overdueCount: number;
}> {
  const { limit = 50, status } = options;

  let query = supabase
    .from('transactions')
    .select('id, ttr_reference, amount, currency, customer_id, created_at, ttr_submission_deadline, ttr_submission_status', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('requires_ttr', true)
    .is('ttr_submitted_at', null)
    .order('ttr_submission_deadline', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (status) {
    query = query.eq('ttr_submission_status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error listing pending TTRs:', error);
    return { transactions: [], total: 0, overdueCount: 0 };
  }

  const now = new Date();
  let overdueCount = 0;

  const transactions = (data || []).map((tx) => {
    const deadline = tx.ttr_submission_deadline ? new Date(tx.ttr_submission_deadline) : null;
    const daysUntil = deadline
      ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const isOverdue = deadline ? deadline < now : false;

    if (isOverdue) overdueCount++;

    return {
      id: tx.id,
      ttr_reference: tx.ttr_reference,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      customer_id: tx.customer_id,
      created_at: tx.created_at,
      ttr_submission_deadline: tx.ttr_submission_deadline,
      ttr_submission_status: tx.ttr_submission_status || 'pending',
      days_until_deadline: daysUntil,
      is_overdue: isOverdue,
    };
  });

  return {
    transactions,
    total: count || 0,
    overdueCount,
  };
}

/**
 * Mark a TTR as submitted to AUSTRAC
 */
export async function markTTRSubmitted(
  supabase: SupabaseClient,
  tenantId: string,
  transactionId: string,
  austracReference?: string
): Promise<{ success: boolean; error?: string }> {
  // Increment submission attempts (if RPC exists)
  const { error: rpcError } = await supabase.rpc('increment_ttr_attempts', {
    transaction_id: transactionId
  });
  // Ignore RPC errors - function may not exist

  const { error } = await supabase
    .from('transactions')
    .update({
      ttr_submitted_at: new Date().toISOString(),
      ttr_submission_status: 'submitted',
      ttr_austrac_reference: austracReference || null,
    })
    .eq('id', transactionId)
    .eq('tenant_id', tenantId)
    .eq('requires_ttr', true);

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'ttr_submitted',
    entity_type: 'transaction',
    entity_id: transactionId,
    description: 'TTR submitted to AUSTRAC',
    metadata: { austrac_reference: austracReference },
  });

  return { success: true };
}

/**
 * Legacy: Generate batch export of TTR transactions (for internal reporting only)
 * This is NOT for AUSTRAC submission - just an internal summary/export
 */
export interface TTRBatchExport {
  exportId: string;
  tenantName: string;
  exportDate: string;
  periodStart: string;
  periodEnd: string;
  transactions: Array<{
    id: string;
    reference: string;
    customerName: string;
    amount: number;
    currency: string;
    date: string;
    status: string;
    deadline: string | null;
  }>;
  summary: {
    total: number;
    pending: number;
    submitted: number;
    overdue: number;
    totalAmount: number;
  };
}

export async function generateTTRBatchExport(
  supabase: SupabaseClient,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<TTRBatchExport> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      ttr_reference,
      amount,
      currency,
      created_at,
      ttr_submission_status,
      ttr_submission_deadline,
      ttr_submitted_at,
      customers (first_name, last_name, company_name, customer_type)
    `)
    .eq('tenant_id', tenantId)
    .eq('requires_ttr', true)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  const now = new Date();
  let pending = 0;
  let submitted = 0;
  let overdue = 0;
  let totalAmount = 0;

  const txList = (transactions || []).map((tx) => {
    const customer = Array.isArray(tx.customers) ? tx.customers[0] : tx.customers;
    const customerName = customer
      ? customer.customer_type === 'business'
        ? customer.company_name
        : `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
      : 'Unknown';

    const deadline = tx.ttr_submission_deadline ? new Date(tx.ttr_submission_deadline) : null;
    const isOverdue = deadline && !tx.ttr_submitted_at && deadline < now;

    if (tx.ttr_submitted_at) submitted++;
    else if (isOverdue) overdue++;
    else pending++;

    totalAmount += parseFloat(tx.amount);

    return {
      id: tx.id,
      reference: tx.ttr_reference || tx.id.slice(0, 8),
      customerName,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      date: tx.created_at,
      status: tx.ttr_submitted_at ? 'submitted' : isOverdue ? 'overdue' : 'pending',
      deadline: tx.ttr_submission_deadline,
    };
  });

  return {
    exportId: `TTR-EXPORT-${Date.now()}`,
    tenantName: tenant?.name || 'Unknown',
    exportDate: new Date().toISOString(),
    periodStart: startDate,
    periodEnd: endDate,
    transactions: txList,
    summary: {
      total: txList.length,
      pending,
      submitted,
      overdue,
      totalAmount,
    },
  };
}
