import { Injectable, Logger } from '@nestjs/common';
import { WebhookDeliveryRepositoryPort } from '../ports/webhook-delivery-repository.port';
import { WebhookQueuePublisherPort } from '../ports/webhook-queue-publisher.port';
import { WebhookSubscriptionRepositoryPort } from '../ports/webhook-subscription-repository.port';
import { NewWebhookDelivery } from '../webhook.types';

/**
 * Entry point from webhook-dispatch.dispatcher.ts: fan out one eligible
 * domain event to every ACTIVE subscription that declared its eventType.
 * `createMany` is idempotent on (subscriptionId, eventId), so a re-delivered
 * outbox event can't double-create deliveries — this method is safe to call
 * more than once for the same event.
 */
@Injectable()
export class DispatchWebhookEventUseCase {
  private readonly logger = new Logger(DispatchWebhookEventUseCase.name);

  constructor(
    private readonly subscriptions: WebhookSubscriptionRepositoryPort,
    private readonly deliveries: WebhookDeliveryRepositoryPort,
    private readonly queuePublisher: WebhookQueuePublisherPort,
  ) {}

  async execute(
    eventType: string,
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const matches = await this.subscriptions.findActiveByEventType(eventType);
    if (matches.length === 0) {
      return;
    }

    const newDeliveries: NewWebhookDelivery[] = matches.map(subscription => ({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      eventId,
      eventType,
      payload,
    }));
    const created = await this.deliveries.createMany(newDeliveries);

    for (const delivery of created) {
      try {
        await this.queuePublisher.enqueueDelivery(delivery.id);
      } catch (err) {
        this.logger.error(
          `Failed to enqueue webhook delivery ${delivery.id} for eventType '${eventType}': ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
