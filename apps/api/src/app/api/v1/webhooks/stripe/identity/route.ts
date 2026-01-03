import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceClient } from '@/lib/db/client';
import {
  triggerPostVerificationActions,
  updateCustomerVerificationStatus,
} from '@/lib/kyc';
import { dispatchKycStatusChanged } from '@/lib/webhooks/dispatcher';
import { sendKycNotification } from '@/lib/utils/notifications';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// POST /v1/webhooks/stripe/identity - Stripe Identity webhook handler
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_IDENTITY_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getServiceClient();

  console.log('=== Stripe Identity Webhook ===');
  console.log('Event type:', event.type);
  console.log('Event ID:', event.id);

  // Handle identity verification events
  if (
    event.type === 'identity.verification_session.verified' ||
    event.type === 'identity.verification_session.requires_input' ||
    event.type === 'identity.verification_session.canceled'
  ) {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    console.log('Session ID:', session.id);
    console.log('Session status:', session.status);
    console.log('Session metadata:', JSON.stringify(session.metadata));

    const tenantId = session.metadata?.tenant_id;
    const customerId = session.metadata?.customer_id;

    if (!tenantId || !customerId) {
      console.error('ERROR: Missing tenant or customer ID in session metadata!');
      console.error('tenant_id:', tenantId, 'customer_id:', customerId);
      console.error('Full metadata:', session.metadata);
      return NextResponse.json({ received: true, error: 'missing_metadata' });
    }

    console.log('Tenant ID:', tenantId);
    console.log('Customer ID:', customerId);

    // Map Stripe status to our status
    const statusMap: Record<string, string> = {
      verified: 'verified',
      requires_input: 'requires_input',
      canceled: 'cancelled',
    };
    const newStatus = statusMap[session.status] || 'processing';

    // Get existing verification record
    console.log('Looking up verification with stripe_session_id:', session.id);
    const { data: verification, error: fetchError } = await supabase
      .from('identity_verifications')
      .select('*')
      .eq('stripe_session_id', session.id)
      .single();

    if (fetchError || !verification) {
      console.error('Verification record not found for session:', session.id, 'Error:', fetchError);
      return NextResponse.json({ received: true });
    }
    console.log('Found verification record:', verification.id, 'current status:', verification.status);

    // Build update object
    const updates: Record<string, unknown> = {
      status: newStatus,
      stripe_verification_id: session.id,
    };

    // Extract verified outputs if available
    if (session.verified_outputs) {
      updates.verified_first_name = session.verified_outputs.first_name;
      updates.verified_last_name = session.verified_outputs.last_name;

      if (session.verified_outputs.dob) {
        const dob = session.verified_outputs.dob;
        updates.verified_dob = `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`;
      }

      if (session.verified_outputs.address) {
        updates.verified_address = {
          line1: session.verified_outputs.address.line1,
          line2: session.verified_outputs.address.line2,
          city: session.verified_outputs.address.city,
          state: session.verified_outputs.address.state,
          postcode: session.verified_outputs.address.postal_code,
          country: session.verified_outputs.address.country,
        };
      }

      if (session.verified_outputs.id_number_type) {
        updates.document_type = session.verified_outputs.id_number_type;
      }
    }

    // Handle errors
    if (session.last_error) {
      updates.rejection_reason = session.last_error.reason;
      updates.rejection_details = { code: session.last_error.code };
    }

    // Update verification record
    console.log('Updating verification to status:', newStatus);
    const { error: updateError } = await supabase
      .from('identity_verifications')
      .update(updates)
      .eq('id', verification.id);

    if (updateError) {
      console.error('Failed to update verification:', updateError);
    } else {
      console.log('Successfully updated verification to:', newStatus);
    }

    // Update customer status
    if (newStatus === 'verified') {
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('email')
        .eq('id', customerId)
        .single();

      if (customer) {
        await sendKycNotification(
          tenantId,
          customer.email,
          'verified',
          updates.verified_first_name as string
        );
      }

      await updateCustomerVerificationStatus(supabase, customerId, 'verified', {
        firstName: updates.verified_first_name as string | undefined,
        lastName: updates.verified_last_name as string | undefined,
        dateOfBirth: updates.verified_dob as string | undefined,
      });

      // Trigger post-verification actions (sanctions screening, etc.)
      await triggerPostVerificationActions(supabase, tenantId, customerId);
    } else if (newStatus === 'rejected' || session.status === 'requires_input') {
      // Notify customer of failure/re-try
      const { data: customer } = await supabase.from('customers').select('email, first_name').eq('id', customerId).single();
      if (customer) {
        await sendKycNotification(tenantId, customer.email, 'rejected', customer.first_name);
      }
      await updateCustomerVerificationStatus(supabase, customerId, 'rejected');
    }
    // Dispatch webhook to customer's endpoint
    await dispatchKycStatusChanged(supabase, tenantId, {
      verificationId: `ver_${verification.id}`,
      customerId: `cus_${customerId}`,
      status: newStatus,
      previousStatus: verification.status,
      provider: 'stripe_identity',
      stripeSessionId: session.id,
      verifiedData:
        newStatus === 'verified' && updates.verified_first_name
          ? {
              firstName: updates.verified_first_name,
              lastName: updates.verified_last_name,
              dateOfBirth: updates.verified_dob,
            }
          : undefined,
    });

    const standardActionType = newStatus === 'verified'
      ? 'kyc_verification_completed'
      : newStatus === 'rejected'
        ? 'kyc_verification_failed'
        : `kyc_verification_${newStatus}`;

    // Audit log using standard action types so they appear in the Webhooks dashboard
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action_type: standardActionType,
      entity_type: 'identity_verification',
      entity_id: verification.id,
      description: `Stripe Identity verification ${session.status}`,
      metadata: {
        stripeSessionId: session.id,
        status: newStatus,
        provider: 'stripe_identity'
      },
    });

    console.log(
      `Processed Stripe Identity event: ${event.type} for customer ${customerId}`
    );
  }

  return NextResponse.json({ received: true });
}
