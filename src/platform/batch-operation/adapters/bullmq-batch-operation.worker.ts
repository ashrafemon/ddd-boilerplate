import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BatchOperationWorker } from '../batch-operation.worker';
import { BatchOperationDispatch } from '../batch-operation.types';
import {
  BATCH_OPERATION_QUEUE_NAME,
  BATCH_OPERATION_WORKER_CONCURRENCY,
} from '../batch-operation.constants';

/**
 * BullMQ consumer — Async path only. Sync calls BatchOperationWorker.processChunk
 * in-process and never hits this queue.
 */
@Processor(BATCH_OPERATION_QUEUE_NAME, { concurrency: BATCH_OPERATION_WORKER_CONCURRENCY })
export class BullMqBatchOperationWorker extends WorkerHost {
  private readonly logger = new Logger(BullMqBatchOperationWorker.name);

  constructor(private readonly chunkWorker: BatchOperationWorker) {
    super();
  }

  async process(job: Job<BatchOperationDispatch>): Promise<void> {
    await this.chunkWorker.processChunk(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<BatchOperationDispatch> | undefined, err: Error): void {
    if (!job) {
      return;
    }
    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Batch chunk ${job.id} for job ${job.data.jobId} exhausted retries: ${err.message}`,
      );
    }
  }
}
