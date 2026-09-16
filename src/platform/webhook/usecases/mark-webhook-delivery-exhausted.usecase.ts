import { Injectable, Logger } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import '../events/webhook.registry';
import { WebhookDeliveryExhaustedEvent } from '../events/webhook-delivery-exhausted.event';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';

/**
 * Entry point from BullMqWebhookWorker's `onFailed` once BullMQ has
 * exhausted every configured attempt for a delivery. Persists the terminal
 * DEAD_LETTER state (DeliverWebhookUseCase already recorded the attempt's
 * own outcome/circuit-breaker bookkeeping before throwing) and announces it
 * so ops tooling can react.
 */
@Injectable()
export class MarkWebhookDeliveryExhaustedUseCase {
  private readonly logger = new Logger(MarkWebhookDeliveryExhaustedUseCase.name);

  constructor(
    private readonly deliveries: WebhookDeliveryRepositoryPort,
    private readonly outbox: OutboxWriterPort,
  ) {}

  async execute(deliveryId: string, lastError: string): Promise<void> {
    const delivery = await this.deliveries.findById(deliveryId);
    if (!delivery) {
      this.logger.warn(`WebhookDelivery ${deliveryId} not found — exhaustion signal dropped`);
      return;
    }
    if (delivery.status === 'DELIVERED' || delivery.status === 'DEAD_LETTER') {
      // Already terminal — a delayed BullMQ 'failed' event racing a
      // meanwhile-successful attempt (or a prior exhaustion). No-op.
      return;
    }

    await this.deliveries.markDeadLettered(deliveryId, delivery.lastResponseCode, lastError);
    await this.outbox.append(
      new WebhookDeliveryExhaustedEvent(
        delivery.id,
        delivery.subscriptionId,
        delivery.eventType,
        delivery.tenantId,
      ),
      'WebhookDelivery',
      delivery.id,
    );
  }
}
