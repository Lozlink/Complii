import type { SupabaseClient } from '@supabase/supabase-js';
import {calculateSMRDeadline} from "@/lib/compliance/deadline-utils";
import { RegionalConfig } from "@/lib/config/regions";
import { createEDDInvestigation, escalateEDDInvestigation } from "@/lib/compliance/edd-service";

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
    transactionIds?: string[];
    totalAmount: number;
    currency: string;
  };
  suspicionGrounds: string;
  actionTaken: string;
  reportingOfficer: {
    name: string;
    position: string;
    contactNumber: string;
  };
  submissionDeadline?: string;
  additionalInformation?: string;
  transactions?: Array<{
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
  config: Pick<RegionalConfig, 'holidays' | 'workweek' | 'deadlines'>,
  input: {
    activityType: 'money_laundering' | 'terrorism_financing' | 'other';
    description: string;
    suspicionFormedDate: string;
    customerId?: string;
    transactionIds?: string[];
    suspicionGrounds: string;
    actionTaken: string;
    reportingOfficer: {
      name: string;
      position: string;
      contactNumber: string;
    };
    additionalInformation?: string;
    skipEddTrigger?: boolean; // Override to prevent auto-triggering EDD
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
  const suspicionFormedDate = new Date(input.suspicionFormedDate);
  const deadline = calculateSMRDeadline(suspicionFormedDate, config);
  // Get transactions

   let transactions = null;
   if (input.transactionIds && input.transactionIds.length > 0) {
     const { data } = await supabase
      .from('transactions')
      .select('*')
      .in('id', input.transactionIds)
      .eq('tenant_id', tenantId);
    transactions = data;
  }

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
    suspicionGrounds: input.suspicionGrounds,
    submissionDeadline: deadline.toISOString(),
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
  const { error: insertError } = await supabase.from('smr_reports').insert({
    tenant_id: tenantId,
    report_number: reportId,
    report_type: input.activityType,
    customer_id: input.customerId,
    suspicion_formed_date: input.suspicionFormedDate,
    suspicion_grounds: input.suspicionGrounds,
    submission_deadline: deadline.toISOString(),
    action_taken: input.actionTaken,
    reporting_officer: input.reportingOfficer,
    transaction_ids: input.transactionIds,
    total_amount: totalAmount,
    currency,
    description: input.description,
    subjects: [],
    status: 'draft',
  });

  if (insertError) {
    console.error('Failed to insert SMR report:', insertError);
    throw new Error(`Failed to save SMR report: ${insertError.message}`);
  }

  // AUTO-TRIGGER EDD INVESTIGATION if customer is linked
  if (input.customerId && !input.skipEddTrigger) {
    const shouldAutoTriggerEDD = [
      'money_laundering',
      'terrorism_financing',
      'fraud',
    ].includes(input.activityType);

    if (shouldAutoTriggerEDD) {
      // Check for existing open EDD investigation
      const { data: existingEdd } = await supabase
        .from('edd_investigations')
        .select('id, investigation_number, status')
        .eq('customer_id', input.customerId)
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'awaiting_customer_info', 'under_review', 'escalated'])
        .maybeSingle();

      if (existingEdd) {
        // Escalate existing EDD investigation
        console.log(`Escalating existing EDD ${existingEdd.investigation_number} due to SMR ${reportId}`);
        await escalateEDDInvestigation(supabase, tenantId, existingEdd.id, {
          reason: `SMR ${reportId} filed for ${input.activityType}: ${input.description.substring(0, 100)}`,
          escalatedBy: 'system',
        });
      } else {
        // Create new EDD investigation
        console.log(`Auto-triggering EDD investigation for customer ${input.customerId} due to SMR ${reportId}`);
        const eddResult = await createEDDInvestigation(supabase, tenantId, {
          customerId: input.customerId,
          transactionId: input.transactionIds?.[0] || null, // Link primary transaction
          triggerReason: `Automatic: SMR filed for ${input.activityType} - ${input.suspicionGrounds.substring(0, 150)}`,
          triggeredBy: 'system',
        });

        if (eddResult.success) {
          // Link SMR to EDD investigation
          await supabase
            .from('smr_reports')
            .update({ metadata: { edd_investigation_id: eddResult.investigation?.id } })
            .eq('id', reportId)
            .eq('tenant_id', tenantId);
        }
      }

      // Update customer risk profile to high risk
      await supabase
        .from('customers')
        .update({
          requires_edd: true,
          risk_level: 'high',
        })
        .eq('id', input.customerId)
        .eq('tenant_id', tenantId);
    }
  }

  // Log audit event
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    action_type: 'smr.generated',
    entity_type: 'smr_report',
    entity_id: reportId,
    description: `SMR generated for ${input.activityType}`,
    metadata: { reportId, customerId: input.customerId, transactionCount: input.transactionIds?.length },
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
  <GroundsForSuspicion>${escapeXml(data.suspicionGrounds)}</GroundsForSuspicion>
  <ActionTaken>${escapeXml(data.actionTaken)}</ActionTaken>
  <ReportingOfficer>
    <Name>${escapeXml(data.reportingOfficer.name)}</Name>
    <Position>${escapeXml(data.reportingOfficer.position)}</Position>
    <ContactNumber>${escapeXml(data.reportingOfficer.contactNumber)}</ContactNumber>
  </ReportingOfficer>
  ${data.additionalInformation ? `<AdditionalInformation>${escapeXml(data.additionalInformation)}</AdditionalInformation>` : ''}
  <Transactions>
    ${data.transactions?.map((txn) => `
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
