import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@config/config.service';
import { WebhookDeliveryRepositoryPort } from './ports/webhook-delivery-repository.port';
import { WebhookQueuePublisherPort } from './ports/webhook-queue-publisher.port';

/**
 * Two safety nets, both re-enqueueing (never fabricating a success):
 *  · DELIVERING past the stuck window — a worker died mid-attempt, leaving
 *    no BullMQ retry to pick the row back up.
 *  · PENDING past the same window with no claim ever attempted — the
 *    process crashed between createMany and the original enqueueDelivery
 *    call, so no BullMQ job for it ever existed.
 * Re-enqueuing an id whose job is still legitimately in-flight is a
 * harmless no-op (jobId = deliveryId dedupes at the queue).
 */
@Injectable()
export class WebhookReconciliation {
  private readonly logger = new Logger(WebhookReconciliation.name);
  private running = false;

  constructor(
    private readonly deliveries: WebhookDeliveryRepositoryPort,
    private readonly queuePublisher: WebhookQueuePublisherPort,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'webhook-reconciliation' })
  async reconcile(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const { reconciliationWindowMs } = this.configService.getWebhook();

      const resetIds = await this.deliveries.resetStuck(reconciliationWindowMs);
      const staleIds = await this.deliveries.findStalePending(reconciliationWindowMs);
      const toReenqueue = [...new Set([...resetIds, ...staleIds])];

      for (const id of toReenqueue) {
        await this.queuePublisher.enqueueDelivery(id);
      }
      if (toReenqueue.length > 0) {
        this.logger.warn(
          `Re-enqueued ${toReenqueue.length} webhook deliveries (${resetIds.length} stuck DELIVERING, ${staleIds.length} stale PENDING)`,
        );
      }
    } finally {
      this.running = false;
    }
  }
}
