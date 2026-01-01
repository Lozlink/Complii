import crypto from 'crypto';

export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const parts = signature.split(',');
  const timestamp = parseInt(parts.find((p) => p.startsWith('t='))?.slice(2) || '0');
  const sig = parts.find((p) => p.startsWith('v1='))?.slice(3);

  if (!timestamp || !sig) {
    return false;
  }

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  // Verify signature
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}
