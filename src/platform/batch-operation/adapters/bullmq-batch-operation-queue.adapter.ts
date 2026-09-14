import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@config/config.service';
import { BatchOperationQueuePublisherPort } from '../ports/batch-operation-queue-publisher.port';
import { Chunker } from '@shared-kernel/utils/chunker.util';
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
export class BullMqBatchOperationQueueAdapter implements BatchOperationQueuePublisherPort {
  private readonly logger = new Logger(BullMqBatchOperationQueueAdapter.name);

  constructor(
    @InjectQueue(BATCH_OPERATION_QUEUE_NAME)
    private readonly queue: Queue<BatchOperationDispatch>,
    private readonly configService: ConfigService,
  ) {}

  async dispatchChunks(dispatch: BatchOperationDispatch): Promise<void> {
    const { chunkSize, chunkAttempts } = this.configService.getBatchOperation();
    const chunks = Chunker.split(dispatch.rowIds, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      const rowIds = chunks[i];
      // Cycle-stamped id: re-dispatch after reconciliation must not collide
      // with a retained failed chunk (row claims, not queue dedupe, provide
      // the double-execution guard).
      const jobId = `${dispatch.jobId}:chunk:${i}:${Date.now()}`;
      try {
        await this.queue.add(
          BATCH_OPERATION_CHUNK_JOB_NAME,
          { ...dispatch, rowIds },
          {
            jobId,
            attempts: chunkAttempts,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: true,
            removeOnFail: { age: 24 * 60 * 60 * 1000 },
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to enqueue chunk ${i} for batch job ${dispatch.jobId}: ${FailureMessage.of(err)}`,
        );
        throw err;
      }
    }
  }
}
