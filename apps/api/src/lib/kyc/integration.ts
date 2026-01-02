import { SupabaseClient } from '@supabase/supabase-js';
import { sanctionsScreening } from '../compliance/screening';
import { getTenantConfig } from '../config/regions';
import { dispatchScreeningMatch } from '../webhooks/dispatcher';

export interface PostVerificationResult {
  sanctionsScreened: boolean;
  isSanctioned: boolean;
  screeningId?: string;
}

/**
 * Trigger post-verification actions after successful KYC verification
 * - Auto-run sanctions screening
 * - Update customer record with screening results
 * - Dispatch webhooks if sanctions match found
 */
export async function triggerPostVerificationActions(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string
): Promise<PostVerificationResult> {
  const result: PostVerificationResult = {
    sanctionsScreened: false,
    isSanctioned: false,
  };

  // Get customer details
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    console.error('Failed to get customer for post-verification:', customerError);
    return result;
  }

  // Get tenant settings
  const { data: tenant } = await supabase
    .from('tenants')
    .select('region, settings')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    console.error('Failed to get tenant for post-verification');
    return result;
  }

  const config = getTenantConfig(tenant.region, tenant.settings);
  const tenantSettings = tenant.settings as Record<string, unknown> | null;

  // Check if auto-screening is enabled (default: true)
  const autoScreen = (tenantSettings?.kyc as Record<string, unknown>)?.autoScreenOnVerification !== false;

  if (!autoScreen) {
    return result;
  }

  // Run sanctions screening
  try {
    const screeningConfig = {
      minimumMatchScore:
        ((tenantSettings?.screening as Record<string, unknown>)?.minimumMatchScore as number) || 0.7,
      sources: config.screeningSources,
    };

    const screeningResult = await sanctionsScreening(
      supabase,
      {
        firstName: customer.first_name,
        lastName: customer.last_name,
        dateOfBirth: customer.date_of_birth,
      },
      screeningConfig
    );

    result.sanctionsScreened = true;
    result.isSanctioned = screeningResult.isMatch;

    // Update customer with screening results
    await supabase
      .from('customers')
      .update({
        is_sanctioned: screeningResult.isMatch,
        last_screened_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    // Save screening record
    const { data: screening } = await supabase
      .from('sanctions_screenings')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        screened_first_name: customer.first_name,
        screened_last_name: customer.last_name,
        screened_dob: customer.date_of_birth,
        is_match: screeningResult.isMatch,
        match_score: screeningResult.matchScore,
        matched_entities: screeningResult.matches,
        status: screeningResult.status,
        screening_sources: screeningResult.sources,
        screened_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (screening) {
      result.screeningId = screening.id;
    }

    // Dispatch webhook if match found
    if (screeningResult.isMatch) {
      await dispatchScreeningMatch(supabase, tenantId, {
        customerId: `cus_${customerId.slice(0, 8)}`,
        screeningId: screening?.id ? `scr_${screening.id.slice(0, 8)}` : undefined,
        isMatch: screeningResult.isMatch,
        matchScore: screeningResult.matchScore,
        matches: screeningResult.matches,
        status: screeningResult.status,
        triggeredBy: 'kyc_verification',
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action_type: 'post_verification_screening',
      entity_type: 'customer',
      entity_id: customerId,
      description: `Auto-screened customer after KYC verification`,
      metadata: {
        isMatch: screeningResult.isMatch,
        matchCount: screeningResult.matches.length,
      },
    });
  } catch (err) {
    console.error('Post-verification screening failed:', err);
    // Don't throw - verification was still successful
  }

  return result;
}

/**
 * Update customer verification status after KYC completion
 */
export async function updateCustomerVerificationStatus(
  supabase: SupabaseClient,
  customerId: string,
  status: 'verified' | 'rejected',
  verifiedData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {
    verification_status: status,
  };
  const cleanId = customerId.startsWith('cus_') ? customerId.slice(4) : customerId;

  // Optionally update verified identity data
  if (status === 'verified' && verifiedData) {
    if (verifiedData.firstName) updates.first_name = verifiedData.firstName;
    if (verifiedData.lastName) updates.last_name = verifiedData.lastName;
    if (verifiedData.dateOfBirth) updates.date_of_birth = verifiedData.dateOfBirth;
  }

  await supabase.from('customers').update(updates).eq('id', customerId);
}
