import type { SupabaseClient } from '@supabase/supabase-js';

export interface IFTIReportData {
  reportId: string;
  reportingPeriod: {
    start: string;
    end: string;
  };
  tenantName: string;
  transfers: Array<{
    id: string;
    transferDate: string;
    amount: number;
    currency: string;
    direction: 'inbound' | 'outbound';
    orderingCustomer: {
      name: string;
      accountNumber?: string;
      address?: string;
      country: string;
    };
    beneficiaryCustomer: {
      name: string;
      accountNumber?: string;
      address?: string;
      country: string;
    };
    orderingInstitution?: {
      name: string;
      bic?: string;
      country: string;
    };
    beneficiaryInstitution?: {
      name: string;
      bic?: string;
      country: string;
    };
    intermediaryInstitution?: {
      name: string;
      bic?: string;
      country: string;
    };
    remittanceInformation?: string;
  }>;
  totalTransfers: number;
  totalAmount: number;
}

export async function generateIFTIReport(
  supabase: SupabaseClient,
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<IFTIReportData> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  // Get tenant details
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();

  // Get international transfers
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      currency,
      created_at,
      description,
      metadata
    `)
    .eq('tenant_id', tenantId)
    .eq('is_international', true)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });

  const transfers = (transactions || []).map((txn) => {
    const metadata = txn.metadata as Record<string, unknown> || {};

    return {
      id: txn.id,
      transferDate: txn.created_at,
      amount: txn.amount,
      currency: txn.currency,
      direction: (metadata.direction as 'inbound' | 'outbound') || 'outbound',
      orderingCustomer: {
        name: (metadata.orderingCustomer as Record<string, string>)?.name || 'Unknown',
        accountNumber: (metadata.orderingCustomer as Record<string, string>)?.accountNumber,
        address: (metadata.orderingCustomer as Record<string, string>)?.address,
        country: (metadata.orderingCustomer as Record<string, string>)?.country || 'Unknown',
      },
      beneficiaryCustomer: {
        name: (metadata.beneficiaryCustomer as Record<string, string>)?.name || 'Unknown',
        accountNumber: (metadata.beneficiaryCustomer as Record<string, string>)?.accountNumber,
        address: (metadata.beneficiaryCustomer as Record<string, string>)?.address,
        country: (metadata.beneficiaryCustomer as Record<string, string>)?.country || 'Unknown',
      },
      orderingInstitution: metadata.orderingInstitution as {
        name: string;
        bic?: string;
        country: string;
      } | undefined,
      beneficiaryInstitution: metadata.beneficiaryInstitution as {
        name: string;
        bic?: string;
        country: string;
      } | undefined,
      intermediaryInstitution: metadata.intermediaryInstitution as {
        name: string;
        bic?: string;
        country: string;
      } | undefined,
      remittanceInformation: txn.description || (metadata.remittanceInformation as string),
    };
  });

  const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);

  const reportId = `IFTI_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const report: IFTIReportData = {
    reportId,
    reportingPeriod: {
      start,
      end,
    },
    tenantName: tenant?.name || 'Unknown',
    transfers,
    totalTransfers: transfers.length,
    totalAmount,
  };

  // Store IFTI report
  await supabase.from('ifti_reports').insert({
    tenant_id: tenantId,
    report_id: reportId,
    start_date: start,
    end_date: end,
    transfer_count: transfers.length,
    total_amount: totalAmount,
    report_data: report,
  });

  // Log audit event
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'ifti.generated',
    entity_type: 'ifti_report',
    entity_id: reportId,
    description: `IFTI report generated for ${start} to ${end}`,
    metadata: { reportId, transferCount: transfers.length, totalAmount },
  });

  return report;
}

export function generateIFTIReportXML(data: IFTIReportData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<IFTI xmlns="http://www.austrac.gov.au/ifti/1.0">
  <ReportId>${data.reportId}</ReportId>
  <ReportingPeriod>
    <StartDate>${data.reportingPeriod.start}</StartDate>
    <EndDate>${data.reportingPeriod.end}</EndDate>
  </ReportingPeriod>
  <ReportingEntity>
    <Name>${escapeXml(data.tenantName)}</Name>
  </ReportingEntity>
  <Summary>
    <TotalTransfers>${data.totalTransfers}</TotalTransfers>
    <TotalAmount>${data.totalAmount}</TotalAmount>
  </Summary>
  <Transfers>
    ${data.transfers.map((transfer) => `
    <Transfer>
      <Id>${escapeXml(transfer.id)}</Id>
      <TransferDate>${transfer.transferDate}</TransferDate>
      <Amount currency="${transfer.currency}">${transfer.amount}</Amount>
      <Direction>${transfer.direction}</Direction>
      <OrderingCustomer>
        <Name>${escapeXml(transfer.orderingCustomer.name)}</Name>
        ${transfer.orderingCustomer.accountNumber ? `<AccountNumber>${escapeXml(transfer.orderingCustomer.accountNumber)}</AccountNumber>` : ''}
        ${transfer.orderingCustomer.address ? `<Address>${escapeXml(transfer.orderingCustomer.address)}</Address>` : ''}
        <Country>${escapeXml(transfer.orderingCustomer.country)}</Country>
      </OrderingCustomer>
      <BeneficiaryCustomer>
        <Name>${escapeXml(transfer.beneficiaryCustomer.name)}</Name>
        ${transfer.beneficiaryCustomer.accountNumber ? `<AccountNumber>${escapeXml(transfer.beneficiaryCustomer.accountNumber)}</AccountNumber>` : ''}
        ${transfer.beneficiaryCustomer.address ? `<Address>${escapeXml(transfer.beneficiaryCustomer.address)}</Address>` : ''}
        <Country>${escapeXml(transfer.beneficiaryCustomer.country)}</Country>
      </BeneficiaryCustomer>
      ${transfer.orderingInstitution ? `
      <OrderingInstitution>
        <Name>${escapeXml(transfer.orderingInstitution.name)}</Name>
        ${transfer.orderingInstitution.bic ? `<BIC>${escapeXml(transfer.orderingInstitution.bic)}</BIC>` : ''}
        <Country>${escapeXml(transfer.orderingInstitution.country)}</Country>
      </OrderingInstitution>
      ` : ''}
      ${transfer.beneficiaryInstitution ? `
      <BeneficiaryInstitution>
        <Name>${escapeXml(transfer.beneficiaryInstitution.name)}</Name>
        ${transfer.beneficiaryInstitution.bic ? `<BIC>${escapeXml(transfer.beneficiaryInstitution.bic)}</BIC>` : ''}
        <Country>${escapeXml(transfer.beneficiaryInstitution.country)}</Country>
      </BeneficiaryInstitution>
      ` : ''}
      ${transfer.remittanceInformation ? `<RemittanceInformation>${escapeXml(transfer.remittanceInformation)}</RemittanceInformation>` : ''}
    </Transfer>
    `).join('')}
  </Transfers>
</IFTI>`;
}

export function generateIFTIReportCSV(data: IFTIReportData): string {
  const headers = [
    'Transfer ID',
    'Date',
    'Amount',
    'Currency',
    'Direction',
    'Ordering Customer',
    'Ordering Country',
    'Beneficiary Customer',
    'Beneficiary Country',
    'Ordering Institution',
    'Beneficiary Institution',
    'Remittance Info',
  ];

  const rows = data.transfers.map((t) => [
    t.id,
    t.transferDate,
    t.amount.toString(),
    t.currency,
    t.direction,
    t.orderingCustomer.name,
    t.orderingCustomer.country,
    t.beneficiaryCustomer.name,
    t.beneficiaryCustomer.country,
    t.orderingInstitution?.name || '',
    t.beneficiaryInstitution?.name || '',
    t.remittanceInformation || '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
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
