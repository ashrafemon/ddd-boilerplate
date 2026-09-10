import { Injectable } from '@nestjs/common';
import { BatchOperationJobRepositoryPort } from '../ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from '../ports/batch-operation-job-row-repository.port';
import { CancelBatchOperationJobPort } from '../ports/cancel-batch-operation-job.port';
import {
  BatchOperationJobNotFoundError,
  BatchOperationNotCancellableError,
} from '../batch-operation.errors';
import { BatchOperationJobRecord } from '../batch-operation.types';

/**
 * PHASE 7. Sets cancel_requested — the worker checks it between row claims and
 * stops claiming, letting an in-flight row finish.
 */
@Injectable()
export class CancelBatchOperationJobUseCase implements CancelBatchOperationJobPort {
  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
  ) {}

  async execute(jobId: string): Promise<BatchOperationJobRecord> {
    const job = await this.jobs.findJob(jobId);
    if (!job) {
      throw new BatchOperationJobNotFoundError(jobId);
    }
    if (isTerminal(job.status)) {
      throw new BatchOperationNotCancellableError(jobId, job.status);
    }

    await this.jobs.setCancelRequested(jobId);

    const pending = await this.rows.rowIds(jobId, 'PENDING');
    if (pending.length === 0) {
      return this.jobs.finaliseCancelled(jobId);
    }
    return (await this.jobs.findJob(jobId)) ?? job;
  }
}

function isTerminal(status: string): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'COMPLETED_WITH_ERRORS' ||
    status === 'FAILED' ||
    status === 'CANCELLED'
  );
}
