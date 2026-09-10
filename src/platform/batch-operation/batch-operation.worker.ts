import { Injectable, Logger } from '@nestjs/common';
import { BatchOperationJobRepositoryPort } from './ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from './ports/batch-operation-job-row-repository.port';
import { BatchOperationJobOutboxWriterPort } from './ports/batch-operation-job-outbox-writer.port';
import { ProcessBatchOperationRowPort } from './ports/process-batch-operation-row.port';
import { BatchOperationDispatch } from './batch-operation.types';

/**
 * Thin driving adapter: consumes a chunk (Async via BullMQ, or Sync in-process),
 * loops entityIds, and delegates each row to ProcessBatchOperationRowUseCase.
 * Never decides whether an operation is allowed on a record.
 */
@Injectable()
export class BatchOperationWorker {
  private readonly logger = new Logger(BatchOperationWorker.name);

  constructor(
    private readonly jobs: BatchOperationJobRepositoryPort,
    private readonly rows: BatchOperationJobRowRepositoryPort,
    private readonly processRow: ProcessBatchOperationRowPort,
    private readonly outboxWriter: BatchOperationJobOutboxWriterPort,
  ) {}

  async processChunk(dispatch: BatchOperationDispatch): Promise<void> {
    await this.jobs.markJobRunning(dispatch.jobId);

    for (const rowId of dispatch.rowIds) {
      const outcome = await this.processRow.execute(dispatch, rowId);
      if (outcome === 'CANCELLED') {
        break;
      }
    }

    await this.finaliseIfComplete(dispatch.jobId);
  }

  private async finaliseIfComplete(jobId: string): Promise<void> {
    const job = await this.jobs.findJob(jobId);
    if (!job || isTerminal(job.status)) {
      return;
    }

    let finalised = null as Awaited<
      ReturnType<BatchOperationJobRepositoryPort['finaliseJob']>
    > | null;

    if (job.processedRecords >= job.totalRecords) {
      finalised = await this.jobs.finaliseJob(jobId);
    } else if (job.cancelRequested) {
      const pending = await this.rows.rowIds(jobId, 'PENDING');
      if (job.processedRecords + pending.length >= job.totalRecords) {
        finalised = await this.jobs.finaliseCancelled(jobId);
      }
    }

    if (finalised) {
      try {
        await this.outboxWriter.writeJobCompletedEvent(finalised);
      } catch (err) {
        this.logger.warn(
          `Outbox write failed for batch job ${jobId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
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
