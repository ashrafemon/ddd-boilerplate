import { outboxEventRegistry } from '@platform/events/registries/outbox-event.registry';
import { WebhookDeliveryExhaustedEvent } from './webhook-delivery-exhausted.event';
import { WebhookSubscriptionAutoPausedEvent } from './webhook-subscription-auto-paused.event';

/** Side-effect import activates this — same shape as recurring/events/recurring.registry.ts. */
class WebhookEventRehydrator {
  static register(): void {
    outboxEventRegistry.register(
      'WebhookDeliveryExhaustedEvent',
      payload =>
        new WebhookDeliveryExhaustedEvent(
          this.string(payload.deliveryId),
          this.string(payload.subscriptionId),
          this.string(payload.eventType),
          this.nullableString(payload.tenantId),
        ),
    );
    outboxEventRegistry.register(
      'WebhookSubscriptionAutoPausedEvent',
      payload =>
        new WebhookSubscriptionAutoPausedEvent(
          this.string(payload.subscriptionId),
          this.nullableString(payload.tenantId),
          this.string(payload.reason),
        ),
    );
  }

  private static string(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private static nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
}

WebhookEventRehydrator.register();
