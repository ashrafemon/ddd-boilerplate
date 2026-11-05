import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationWorker } from '../notification.worker';
import { NotificationDispatch } from '../notification.types';
import {
  NOTIFICATION_QUEUE_NAME,
  NOTIFICATION_WORKER_CONCURRENCY,
} from '../notification.constants';

/**
 * BullMQ consumer — Async path only. Sync calls NotificationWorker.processChunk
 * in-process and never hits this queue.
 */
@Processor(NOTIFICATION_QUEUE_NAME, { concurrency: NOTIFICATION_WORKER_CONCURRENCY })
export class BullMqNotificationWorker extends WorkerHost {
  private readonly logger = new Logger(BullMqNotificationWorker.name);

  constructor(private readonly chunkWorker: NotificationWorker) {
    super();
  }

  async process(job: Job<NotificationDispatch>): Promise<void> {
    await this.chunkWorker.processChunk(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationDispatch> | undefined, err: Error): void {
    if (!job) {
      return;
    }
    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Notification chunk ${job.id} for request ${job.data.notificationRequestId} exhausted retries: ${err.message}`,
      );
    }
  }
}
