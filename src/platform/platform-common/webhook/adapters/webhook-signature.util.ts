import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256 shared-secret sign + verify pair for outbound delivery
 * payloads. Deliberately duplicated (not imported) from notification's own
 * `adapters/webhook-signature.util.ts` — that one verifies INBOUND
 * SES/SNS delivery receipts and stays notification's concern; this one
 * SIGNS outbound deliveries to a subscriber's `secret`. Both are ~15-line
 * pure functions, so keeping the modules independent costs nothing.
 */
export class WebhookSignatureUtils {
  static signWebhookPayload(secret: string, payload: unknown): string {
    return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  static verifyWebhookSignature(
    secret: string,
    rawBody: unknown,
    signature: string | undefined,
  ): boolean {
    if (!signature) {
      return false;
    }
    const expected = WebhookSignatureUtils.signWebhookPayload(secret, rawBody);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');
    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  }
}

/** Sign an outbound webhook payload. */
export const signWebhookPayload = WebhookSignatureUtils.signWebhookPayload;

/** Verify an inbound webhook HMAC signature. */
export const verifyWebhookSignature = WebhookSignatureUtils.verifyWebhookSignature;
