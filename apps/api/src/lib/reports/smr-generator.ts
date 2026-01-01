import type { SupabaseClient } from '@supabase/supabase-js';

export interface SMRReportData {
  reportId: string;
  submissionDate: string;
  tenantName: string;
  suspectedActivity: {
    id: string;
    type: 'money_laundering' | 'terrorism_financing' | 'other';
    description: string;
    suspicionFormedDate: string;
    customerId?: string;
    customerName?: string;
    transactionIds: string[];
    totalAmount: number;
    currency: string;
  };
  groundsForSuspicion: string;
  actionTaken: string;
  reportingOfficer: {
    name: string;
    position: string;
    contactNumber: string;
  };
  additionalInformation?: string;
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    currency: string;
    type: string;
    description?: string;
    parties: {
      from?: string;
      to?: string;
    };
  }>;
}

export async function generateSMRReport(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    activityType: 'money_laundering' | 'terrorism_financing' | 'other';
    description: string;
    suspicionFormedDate: string;
    customerId?: string;
    transactionIds: string[];
    groundsForSuspicion: string;
    actionTaken: string;
    reportingOfficer: {
      name: string;
      position: string;
      contactNumber: string;
    };
    additionalInformation?: string;
  }
): Promise<SMRReportData> {
  // Get tenant details
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  // Get customer if provided
  let customerName: string | undefined;
  if (input.customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name')
      .eq('id', input.customerId)
      .eq('tenant_id', tenantId)
      .single();

    if (customer) {
      customerName = `${customer.first_name} ${customer.last_name}`;
    }
  }

  // Get transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in('id', input.transactionIds)
    .eq('tenant_id', tenantId);

  const totalAmount = transactions?.reduce((sum, txn) => sum + txn.amount, 0) || 0;
  const currency = transactions?.[0]?.currency || 'AUD';

  const reportId = `SMR_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const report: SMRReportData = {
    reportId,
    submissionDate: new Date().toISOString(),
    tenantName: tenant?.name || 'Unknown',
    suspectedActivity: {
      id: `ACT_${Date.now()}`,
      type: input.activityType,
      description: input.description,
      suspicionFormedDate: input.suspicionFormedDate,
      customerId: input.customerId,
      customerName,
      transactionIds: input.transactionIds,
      totalAmount,
      currency,
    },
    groundsForSuspicion: input.groundsForSuspicion,
    actionTaken: input.actionTaken,
    reportingOfficer: input.reportingOfficer,
    additionalInformation: input.additionalInformation,
    transactions:
      transactions?.map((txn) => ({
        id: txn.id,
        date: txn.created_at,
        amount: txn.amount,
        currency: txn.currency,
        type: txn.transaction_type || 'unknown',
        description: txn.description,
        parties: {
          from: txn.metadata?.from as string | undefined,
          to: txn.metadata?.to as string | undefined,
        },
      })) || [],
  };

  // Store SMR in database
  await supabase.from('smr_reports').insert({
    tenant_id: tenantId,
    report_id: reportId,
    activity_type: input.activityType,
    customer_id: input.customerId,
    suspicion_formed_date: input.suspicionFormedDate,
    grounds_for_suspicion: input.groundsForSuspicion,
    action_taken: input.actionTaken,
    reporting_officer: input.reportingOfficer,
    transaction_ids: input.transactionIds,
    total_amount: totalAmount,
    currency,
    report_data: report,
    status: 'draft',
  });

  // Log audit event
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'smr.generated',
    entity_type: 'smr_report',
    entity_id: reportId,
    description: `SMR generated for ${input.activityType}`,
    metadata: { reportId, customerId: input.customerId, transactionCount: input.transactionIds.length },
  });

  return report;
}

export function generateSMRReportXML(data: SMRReportData): string {
  // Generate AUSTRAC-compliant XML format
  return `<?xml version="1.0" encoding="UTF-8"?>
<SMR xmlns="http://www.austrac.gov.au/smr/1.0">
  <ReportId>${data.reportId}</ReportId>
  <SubmissionDate>${data.submissionDate}</SubmissionDate>
  <ReportingEntity>
    <Name>${escapeXml(data.tenantName)}</Name>
  </ReportingEntity>
  <SuspectedActivity>
    <Type>${data.suspectedActivity.type}</Type>
    <Description>${escapeXml(data.suspectedActivity.description)}</Description>
    <SuspicionFormedDate>${data.suspectedActivity.suspicionFormedDate}</SuspicionFormedDate>
    ${data.suspectedActivity.customerName ? `<CustomerName>${escapeXml(data.suspectedActivity.customerName)}</CustomerName>` : ''}
    <TotalAmount currency="${data.suspectedActivity.currency}">${data.suspectedActivity.totalAmount}</TotalAmount>
  </SuspectedActivity>
  <GroundsForSuspicion>${escapeXml(data.groundsForSuspicion)}</GroundsForSuspicion>
  <ActionTaken>${escapeXml(data.actionTaken)}</ActionTaken>
  <ReportingOfficer>
    <Name>${escapeXml(data.reportingOfficer.name)}</Name>
    <Position>${escapeXml(data.reportingOfficer.position)}</Position>
    <ContactNumber>${escapeXml(data.reportingOfficer.contactNumber)}</ContactNumber>
  </ReportingOfficer>
  ${data.additionalInformation ? `<AdditionalInformation>${escapeXml(data.additionalInformation)}</AdditionalInformation>` : ''}
  <Transactions>
    ${data.transactions.map((txn) => `
    <Transaction>
      <Id>${escapeXml(txn.id)}</Id>
      <Date>${txn.date}</Date>
      <Amount currency="${txn.currency}">${txn.amount}</Amount>
      <Type>${escapeXml(txn.type)}</Type>
      ${txn.description ? `<Description>${escapeXml(txn.description)}</Description>` : ''}
    </Transaction>
    `).join('')}
  </Transactions>
</SMR>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
