import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DeliverWebhookUseCase } from '../usecases/deliver-webhook.usecase';
import { MarkWebhookDeliveryExhaustedUseCase } from '../usecases/mark-webhook-delivery-exhausted.usecase';
import { WEBHOOK_QUEUE_NAME, WEBHOOK_WORKER_CONCURRENCY } from '../webhook.constants';

/**
 * BullMQ consumer. Each delivery is its own job (jobId = deliveryId) — BullMQ
 * owns retry timing via `attempts`/`backoff` (set at enqueue time in
 * BullMqWebhookQueueAdapter); DeliverWebhookUseCase always throws on failure
 * so BullMQ schedules the next attempt. Only once the LAST attempt has also
 * failed (`attemptsMade >= maxAttempts`, same check as
 * BullMqNotificationWorker) does this worker persist the terminal
 * DEAD_LETTER state — mid-retry failures are already recorded by the use
 * case itself before it throws.
 */
@Processor(WEBHOOK_QUEUE_NAME, { concurrency: WEBHOOK_WORKER_CONCURRENCY })
export class BullMqWebhookWorker extends WorkerHost {
  private readonly logger = new Logger(BullMqWebhookWorker.name);

  constructor(
    private readonly deliverWebhook: DeliverWebhookUseCase,
    private readonly markExhausted: MarkWebhookDeliveryExhaustedUseCase,
  ) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<void> {
    await this.deliverWebhook.execute(job.data.deliveryId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ deliveryId: string }> | undefined, err: Error): Promise<void> {
    if (!job) {
      return;
    }
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Webhook delivery ${job.data.deliveryId} exhausted retries: ${err.message}`,
      );
      await this.markExhausted.execute(job.data.deliveryId, err.message);
    }
  }
}
