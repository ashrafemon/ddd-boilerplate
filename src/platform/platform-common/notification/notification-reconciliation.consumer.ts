import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { NotificationMessageRepositoryPort } from './ports/notification-message-repository.port';
import { NotificationQueuePublisherPort } from './ports/notification-queue-publisher.port';
import { NotificationRequestRepositoryPort } from './ports/notification-request-repository.port';

/**
 * PHASE 8.5. Two different stalls, handled differently:
 *   · a message stuck RENDERING past a short window — the worker died
 *     between claim and send — is reset to PENDING and its request
 *     re-dispatched; the send claim (5.1) makes reprocessing safe.
 *   · a message SENT with no receipt past a much longer window is only
 *     flagged (logged) — the provider may simply not webhook for this event
 *     type; nothing here may fabricate a Delivered.
 */
@Injectable()
export class NotificationReconciliationConsumer {
  private readonly logger = new Logger(NotificationReconciliationConsumer.name);
  private running = false;

  constructor(
    private readonly messages: NotificationMessageRepositoryPort,
    private readonly requests: NotificationRequestRepositoryPort,
    private readonly queuePublisher: NotificationQueuePublisherPort,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'notification-reconciliation' })
  async reconcile(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const { renderingStuckWindowMs, sentNoReceiptWindowMs } =
        this.configService.getNotificationPipeline();

      const reset = await this.messages.resetStuckRendering(renderingStuckWindowMs);
      if (reset > 0) {
        this.logger.warn(`Reset ${reset} notification messages stuck in RENDERING`);
      }

      const resumable = await this.requests.findResumableRequests();
      for (const request of resumable) {
        const messageIds = await this.messages.messageIds(request.id, 'PENDING');
        if (messageIds.length === 0) {
          continue;
        }
        this.logger.warn(
          `Re-dispatching ${messageIds.length} PENDING messages for notification request ${request.id}`,
        );
        await this.queuePublisher.dispatchChunks({
          notificationRequestId: request.id,
          notificationType: request.notificationType,
          tenantId: request.tenantId ?? undefined,
          traceId: undefined,
          defaultLocale: undefined,
          messageIds,
        });
      }

      const staleSent = await this.messages.findSentWithNoReceipt(sentNoReceiptWindowMs);
      if (staleSent.length > 0) {
        this.logger.warn(
          `${staleSent.length} notification messages SENT with no delivery receipt past the reconciliation window — flagged for review`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
