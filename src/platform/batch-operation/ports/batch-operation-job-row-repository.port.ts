import {
  BatchOperationRowOutcome,
  BatchOperationRowRecord,
  ClaimedBatchOperationRow,
} from '../batch-operation.types';

/**
 * Persistence of batch_operation_job_rows. The claim
 * (`UPDATE ... WHERE status='PENDING'`) is the execution idempotency guarantee.
 */
export abstract class BatchOperationJobRowRepositoryPort {
  /** Row ids for a job, optionally filtered by status (e.g. re-dispatch only Pending). */
  abstract rowIds(jobId: string, status?: 'PENDING'): Promise<string[]>;

  abstract findRowsByJobId(jobId: string): Promise<BatchOperationRowRecord[]>;

  /**
   * THE claim: `UPDATE ... SET status='PROCESSING' WHERE id=? AND status='PENDING' RETURNING id`.
   * Null means another delivery already took it — skip silently, no error.
   */
  abstract claimRow(rowId: string): Promise<ClaimedBatchOperationRow | null>;

  abstract markRowSuccess(
    rowId: string,
    resultSnapshot: Record<string, unknown> | null,
    processingTimeMs: number,
  ): Promise<void>;

  abstract markRowFailed(
    rowId: string,
    errorMessage: string,
    processingTimeMs: number,
  ): Promise<void>;

  abstract markRowSkipped(
    rowId: string,
    skipReason: string,
    processingTimeMs: number,
  ): Promise<void>;

  /** Resets rows stuck PROCESSING past the window back to PENDING. Returns the count. */
  abstract resetStuckRows(olderThanMs: number): Promise<number>;
}

/** Outcome counters live on the job header — row repo does not bump them. */
export type { BatchOperationRowOutcome };
