import { OutboxEventBase } from '@platform/outbox/outbox.types';

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
