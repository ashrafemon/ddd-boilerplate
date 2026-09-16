import { OutboxEventBase } from '@platform/events/bases/outbox-event.base';

export class WebhookDeliveryExhaustedEvent extends OutboxEventBase {
  constructor(
    public readonly deliveryId: string,
    public readonly subscriptionId: string,
    public readonly eventType: string,
    public readonly tenantId: string | null,
  ) {
    super();
  }
}
