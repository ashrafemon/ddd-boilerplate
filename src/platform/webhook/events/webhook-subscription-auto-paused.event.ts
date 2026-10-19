import { OutboxEventBase } from '@platform/outbox/outbox.types';

export class WebhookSubscriptionAutoPausedEvent extends OutboxEventBase {
  constructor(
    public readonly subscriptionId: string,
    public readonly tenantId: string | null,
    public readonly reason: string,
  ) {
    super();
  }
}
