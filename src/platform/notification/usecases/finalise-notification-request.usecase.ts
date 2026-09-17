import { Injectable, Logger } from '@nestjs/common';
import { NotificationMessageRepositoryPort } from '../ports/notification-message-repository.port';
import { NotificationOutboxWriterPort } from '../ports/notification-outbox-writer.port';
import { NotificationRequestRepositoryPort } from '../ports/notification-request-repository.port';
import { isTerminalNotificationRequestStatus } from '../notification.types';

/**
 * PHASE 7. When every message has left Pending/Rendering, derives the
 * terminal request status from its counters and writes the completion event
 * to the outbox. 'Completed' means fully DISPATCHED, not fully DELIVERED —
 * delivery is still settling via Phase 6.
 */
@Injectable()
export class FinaliseNotificationRequestUseCase {
  private readonly logger = new Logger(FinaliseNotificationRequestUseCase.name);

  constructor(
    private readonly requests: NotificationRequestRepositoryPort,
    private readonly messages: NotificationMessageRepositoryPort,
    private readonly outboxWriter: NotificationOutboxWriterPort,
  ) {}

  async execute(requestId: string): Promise<void> {
    const request = await this.requests.findById(requestId);
    if (!request || isTerminalNotificationRequestStatus(request.status)) {
      return;
    }

    if (await this.messages.hasInFlightMessages(requestId)) {
      return;
    }

    const finalised = await this.requests.finalise(requestId);
    try {
      await this.outboxWriter.writeRequestCompletedEvent(finalised);
    } catch (err) {
      this.logger.warn(
        `Outbox write failed for notification request ${requestId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
