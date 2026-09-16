import { OutboxEventBase } from '@platform/events/bases/outbox-event.base';

export class WebhookSubscriptionAutoPausedEvent extends OutboxEventBase {
  constructor(
    public readonly subscriptionId: string,
    public readonly tenantId: string | null,
    public readonly reason: string,
  ) {
    super();
  }
}
