import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { NotificationOutboxWriterPort } from '../ports/notification-outbox-writer.port';
import { NotificationRequestCompletedEvent } from '../events/notification-request-completed.event';
import { NotificationRequestRecord } from '../notification.types';

@Injectable()
export class PrismaNotificationOutboxWriter implements NotificationOutboxWriterPort {
  constructor(private readonly outbox: OutboxWriterPort) {}

  async writeRequestCompletedEvent(request: NotificationRequestRecord): Promise<void> {
    await this.outbox.append(
      new NotificationRequestCompletedEvent(
        request.id,
        request.notificationType,
        request.status,
        request.totalMessages,
        request.sentMessages,
        request.failedMessages,
        request.suppressedMessages,
        request.tenantId,
      ),
      'NotificationRequest',
      request.id,
    );
  }
}
