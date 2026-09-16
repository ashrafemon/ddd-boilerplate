import { Injectable } from '@nestjs/common';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';
import { WebhookQueuePublisherPort } from '../ports/webhook-queue-publisher.port';
import { WebhookDeliveryRecord } from '../webhook.types';

/** Admin manual retry of a DEAD_LETTER delivery — attemptCount is preserved
 * (it's real attempt history), only status/nextAttemptAt/claimedAt reset. */
@Injectable()
export class RedeliverWebhookUseCase {
  constructor(
    private readonly deliveries: WebhookDeliveryRepositoryPort,
    private readonly queuePublisher: WebhookQueuePublisherPort,
  ) {}

  async execute(deliveryId: string): Promise<WebhookDeliveryRecord> {
    const reset = await this.deliveries.resetForRedelivery(deliveryId);
    await this.queuePublisher.enqueueDelivery(reset.id);
    return reset;
  }
}
