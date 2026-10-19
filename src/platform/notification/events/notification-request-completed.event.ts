import { OutboxEventBase } from '@platform/outbox/outbox.types';
import { NotificationRequestStatus } from '../notification.types';

/** Raised when a notification request reaches a terminal status. */
export class NotificationRequestCompletedEvent extends OutboxEventBase {
  constructor(
    public readonly requestId: string,
    public readonly notificationType: string,
    public readonly status: NotificationRequestStatus,
    public readonly totalMessages: number,
    public readonly sentMessages: number,
    public readonly failedMessages: number,
    public readonly suppressedMessages: number,
    public readonly tenantId: string | null,
  ) {
    super();
  }
}
