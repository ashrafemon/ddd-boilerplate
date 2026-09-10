import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { BatchOperationQueuePublisherPort } from '../ports/batch-operation-queue-publisher.port';
import { BatchOperationDispatch } from '../batch-operation.types';
import {
  BATCH_OPERATION_CHUNK_JOB_NAME,
  BATCH_OPERATION_QUEUE_NAME,
} from '../batch-operation.constants';

/**
 * BullMQ transport for Async chunks. Chunk boundaries are fixed at creation
 * and never overlap — avoids SKIP LOCKED contention.
 */
@Injectable()
export class BullMqBatchOperationQueuePublisher implements BatchOperationQueuePublisherPort {
  private readonly logger = new Logger(BullMqBatchOperationQueuePublisher.name);

  constructor(
    @InjectQueue(BATCH_OPERATION_QUEUE_NAME)
    private readonly queue: Queue<BatchOperationDispatch>,
    private readonly configService: ConfigService,
  ) {}

  async dispatchChunks(dispatch: BatchOperationDispatch): Promise<void> {
    const { chunkSize, chunkAttempts } = this.configService.getBatchOperation();
    const chunks = partition(dispatch.rowIds, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      const rowIds = chunks[i];
      // Include first row id so reconciliation re-partitions stay unique vs prior chunks.
      const jobId = `${dispatch.jobId}:chunk:${i}:${rowIds[0]}`;
      try {
        await this.queue.add(
          BATCH_OPERATION_CHUNK_JOB_NAME,
          { ...dispatch, rowIds },
          {
            jobId,
            attempts: chunkAttempts,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: true,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to enqueue chunk ${i} for batch job ${dispatch.jobId}: ${
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
