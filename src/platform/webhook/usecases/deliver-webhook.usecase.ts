import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { signWebhookPayload } from '../adapters/webhook-signature.util';
import '../events/webhook.registry';
import { WebhookSubscriptionAutoPausedEvent } from '../events/webhook-subscription-auto-paused.event';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import { WebhookTransportPort } from '../ports/webhook-transport.port';

/**
 * Entry point from BullMqWebhookWorker: one delivery attempt. BullMQ owns
 * retry timing (attempts/backoff set at enqueue time) — this method always
 * throws on failure so BullMQ schedules the next attempt; the worker's
 * `onFailed` handler persists DEAD_LETTER once BullMQ itself gives up.
 */
@Injectable()
export class DeliverWebhookUseCase {
  private readonly logger = new Logger(DeliverWebhookUseCase.name);

  constructor(
    private readonly deliveries: WebhookDeliveryRepositoryPort,
    private readonly subscriptions: WebhookSubscriptionRepositoryPort,
    private readonly transport: WebhookTransportPort,
    private readonly outbox: OutboxWriterPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(deliveryId: string): Promise<void> {
    const claimed = await this.deliveries.claim(deliveryId);
    if (!claimed) {
      // Already DELIVERED/DEAD_LETTER, or claimed by a concurrent attempt —
      // jobId=deliveryId should make this rare, but it's a safe no-op.
      return;
    }

    const subscription = await this.subscriptions.findById(claimed.subscriptionId);
    if (!subscription || subscription.status !== 'ACTIVE') {
      await this.deliveries.markDeadLettered(
        deliveryId,
        null,
        `WebhookSubscription '${claimed.subscriptionId}' is not ACTIVE`,
      );
      return;
    }

    const config = this.configService.getWebhook();
    const signature = signWebhookPayload(subscription.secret, claimed.payload);

    try {
      const response = await this.transport.post(
        subscription.url,
        claimed.payload,
        {
          'x-webhook-signature': signature,
          'x-webhook-event-type': claimed.eventType,
          'x-webhook-delivery-id': claimed.id,
        },
        config.deliveryTimeoutMs,
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        await this.deliveries.markDelivered(deliveryId, response.statusCode);
        await this.subscriptions.recordDeliveryOutcome(subscription.id, { success: true });
        return;
      }
      throw new Error(`Subscriber responded with status ${response.statusCode}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const responseCode = extractStatusCode(message);
      const nextAttemptAt = new Date(Date.now() + config.backoffBaseMs * 2 ** claimed.attemptCount);
      await this.deliveries.markFailedForRetry(deliveryId, nextAttemptAt, responseCode, message);

      const updatedSubscription = await this.subscriptions.recordDeliveryOutcome(subscription.id, {
        success: false,
      });
      if (
        updatedSubscription.status === 'ACTIVE' &&
        updatedSubscription.consecutiveFailures >= config.circuitBreakerThreshold
      ) {
        await this.subscriptions.update(subscription.id, { status: 'PAUSED' });
        await this.outbox.append(
          new WebhookSubscriptionAutoPausedEvent(
            subscription.id,
            subscription.tenantId,
            `${updatedSubscription.consecutiveFailures} consecutive delivery failures`,
          ),
          'WebhookSubscription',
          subscription.id,
        );
        this.logger.warn(
          `WebhookSubscription ${subscription.id} auto-paused after ${updatedSubscription.consecutiveFailures} consecutive failures`,
        );
      }
      throw err;
    }
  }
}

/** Best-effort extraction of "responded with status NNN" — null for pure network/timeout errors. */
function extractStatusCode(message: string): number | null {
  const match = /status (\d+)/.exec(message);
  return match ? Number(match[1]) : null;
}
