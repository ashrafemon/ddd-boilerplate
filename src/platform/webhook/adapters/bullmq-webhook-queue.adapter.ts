import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { WebhookQueuePublisherPort } from '../ports/webhook-queue-publisher.port';
import { WEBHOOK_DELIVERY_JOB_NAME, WEBHOOK_QUEUE_NAME } from '../webhook.constants';

/**
 * BullMQ transport for delivery attempts. jobId = deliveryId gives BullMQ-
 * level dedupe on top of the DB-level (subscriptionId, eventId) uniqueness —
 * same trick notification's chunk queue uses with its deterministic jobId.
 */
@Injectable()
export class BullMqWebhookQueueAdapter implements WebhookQueuePublisherPort {
  private readonly logger = new Logger(BullMqWebhookQueueAdapter.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE_NAME)
    private readonly queue: Queue<{ deliveryId: string }>,
    private readonly configService: ConfigService,
  ) {}

  async enqueueDelivery(deliveryId: string): Promise<void> {
    const { deliveryAttempts, backoffBaseMs } = this.configService.getWebhook();
    try {
      await this.queue.add(
        WEBHOOK_DELIVERY_JOB_NAME,
        { deliveryId },
        {
          jobId: deliveryId,
          attempts: deliveryAttempts,
          backoff: { type: 'exponential', delay: backoffBaseMs },
          removeOnComplete: true,
          // Frees the jobId once exhausted so RedeliverWebhookUseCase can
          // re-enqueue the same deliveryId later — BullMQ won't create a
          // second job under an id still held by a permanently-failed one.
          removeOnFail: true,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue webhook delivery ${deliveryId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }
}
