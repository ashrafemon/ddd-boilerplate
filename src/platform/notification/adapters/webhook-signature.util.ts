import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256 shared-secret check for inbound provider webhooks. A
 * deliberate simplification of AWS SNS's own certificate-chain signature
 * scheme (fetching the signing cert URL and verifying an X.509 chain) —
 * this repo has no certificate-verification utility today. Swapping in real
 * SNS signature verification later only touches this function; the
 * mandatory "verify before trusting" rule at the call site does not change.
 */
export function verifyWebhookSignature(
  secret: string,
  payload: unknown,
  signature: string | undefined,
): boolean {
  if (!signature) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signature, 'utf8');
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
