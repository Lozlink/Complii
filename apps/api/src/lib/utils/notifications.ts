import { Resend } from 'resend';
import { getServiceClient } from '../db/client';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendKycNotification(
  tenantId: string,
  customerEmail: string,
  status: 'verified' | 'rejected' | 'started',
  firstName?: string
) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('[Notification] Error: RESEND_API_KEY is not defined in environment variables.');
      return;
    }

    const supabase = getServiceClient();

    // Fetch tenant info to personalize the email
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    const companyName = tenant?.name || 'Complii';
    const name = firstName || 'there';

    let subject = '';
    let html = '';

    if (status === 'started') {
      subject = `Action Required: Verify your identity with ${companyName}`;
      html = `<p>Hi ${name},</p><p><strong>${companyName}</strong> has requested that you verify your identity.</p><p>Please log in to your dashboard to upload the required documents and complete the process.</p>`;
    } else if (status === 'verified') {
      subject = `Identity Verified - ${companyName}`;
      html = `<p>Hi ${name},</p><p>Great news! Your identity has been successfully verified with <strong>${companyName}</strong>.</p><p>You can now access all features of your account.</p>`;
    } else {
      subject = `Action Required: Verification Update from ${companyName}`;
      html = `<p>Hi ${name},</p><p>We were unable to verify your identity for <strong>${companyName}</strong>. This is usually due to a blurry photo or an expired document.</p><p>Please log back in to try again.</p>`;
    }

    const result = await resend.emails.send({
      from: 'Complii Alerts <onboarding@resend.dev>',
      // testing
      to: 'mark.mekhayl@gmail.com',
      subject: subject,
      html: html,
    });

    console.log(`[Notification] Email status: ${status} sent to ${customerEmail}. ID: ${result.data?.id}`);
    return result;
  } catch (error) {
    console.error('[Notification] Failed to send email via Resend:', error);
  }
}