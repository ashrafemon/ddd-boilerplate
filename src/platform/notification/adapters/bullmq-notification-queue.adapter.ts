import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { NotificationQueuePublisherPort } from '../ports/notification-queue-publisher.port';
import { NotificationDispatch } from '../notification.types';
import { NOTIFICATION_CHUNK_JOB_NAME, NOTIFICATION_QUEUE_NAME } from '../notification.constants';

/**
 * BullMQ transport for Async chunks. Chunk boundaries are fixed at creation
 * and never overlap — avoids SKIP LOCKED contention.
 */
@Injectable()
export class BullMqNotificationQueueAdapter implements NotificationQueuePublisherPort {
  private readonly logger = new Logger(BullMqNotificationQueueAdapter.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE_NAME)
    private readonly queue: Queue<NotificationDispatch>,
    private readonly configService: ConfigService,
  ) {}

  async dispatchChunks(dispatch: NotificationDispatch): Promise<void> {
    const { chunkSize, chunkAttempts } = this.configService.getNotificationPipeline();
    const chunks = partition(dispatch.messageIds, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      const messageIds = chunks[i];
      // Include first message id so reconciliation re-partitions stay unique vs prior chunks.
      const jobId = `${dispatch.notificationRequestId}:chunk:${i}:${messageIds[0]}`;
      try {
        await this.queue.add(
          NOTIFICATION_CHUNK_JOB_NAME,
          { ...dispatch, messageIds },
          {
            jobId,
            attempts: chunkAttempts,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: true,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to enqueue chunk ${i} for notification request ${dispatch.notificationRequestId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }
    }
  }
}

function partition<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
