import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';
import { WebhookInboundSourceRegistry } from '../webhook-inbound-source.registry';
import { InboundWebhookContext } from '../webhook.types';
import { InvalidWebhookSignatureError } from '../webhook.errors';

/**
 * Generic inbound entry point — unrelated to notification's own SES/SNS
 * delivery-receipt webhook, which stays notification's concern untouched.
 * Reuses the platform idempotency ledger for dedupe exactly as
 * PLATFORM-SERVICE-GUIDE's "Leases & dedupe" section prescribes: no new
 * table for inbound replay suppression.
 */
@Injectable()
export class ReceiveInboundWebhookUseCase {
  constructor(
    private readonly sources: WebhookInboundSourceRegistry,
    private readonly idempotency: IdempotencyPort,
  ) {}

  async execute(
    source: string,
    rawBody: unknown,
    signature: string | undefined,
    idempotencyKey: string | undefined,
  ): Promise<void> {
    const { verify, handler } = this.sources.resolve(source);
    if (!verify(rawBody, signature)) {
      throw new InvalidWebhookSignatureError(source);
    }

    const key = idempotencyKey ?? hashBody(rawBody);
    const result = await this.idempotency.reserve({
      tenantId: '',
      organizationId: '',
      scope: `webhook.inbound.${source}`,
      key,
    });

    if (result.status === 'REPLAY') {
      return;
    }
    if (result.status === 'IN_PROGRESS') {
      // Another in-flight delivery of the same webhook is already being
      // handled — let the provider's own retry find it COMPLETED next time.
      return;
    }
    if (result.status === 'KEY_REUSED' || result.status === 'SUSPENDED') {
      return;
    }

    const context: InboundWebhookContext = { source, receivedAt: new Date() };
    try {
      await handler.handle(rawBody, context);
      await this.idempotency.complete({
        reservation: result.reservation,
        result: { success: true },
      });
    } catch (err) {
      await this.idempotency.fail({ reservation: result.reservation });
      throw err;
    }
  }
}

function hashBody(rawBody: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(rawBody ?? null))
    .digest('hex');
}
