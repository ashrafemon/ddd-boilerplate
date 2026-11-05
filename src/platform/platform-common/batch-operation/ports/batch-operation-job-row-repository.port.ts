import {
  BatchOperationRowSettlement,
  BatchOperationRowRecord,
  ClaimedBatchOperationRow,
} from '../batch-operation.types';

/**
 * Persistence of batch_operation_job_rows. The claim
 * (`UPDATE ... WHERE status='PENDING'` bumping `claimToken`) is the execution
 * idempotency guarantee, and every terminal write is fenced by the token the
 * claim returned — a row re-claimed after the reconcile window can no longer
 * be settled by the stale worker that lost it.
 */
export abstract class BatchOperationJobRowRepositoryPort {
  /** Row ids for a job, optionally filtered by status (e.g. re-dispatch only Pending). */
  abstract rowIds(jobId: string, status?: 'PENDING'): Promise<string[]>;

  abstract findRowsByJobId(jobId: string): Promise<BatchOperationRowRecord[]>;

  /**
   * THE claim: `UPDATE ... SET status='PROCESSING', claimToken+1
   * WHERE id=? AND status='PENDING' RETURNING ...`. Null means another
   * delivery already took it — skip silently, no error.
   */
  abstract claimRow(rowId: string): Promise<ClaimedBatchOperationRow | null>;

  /**
   * Row status + job header counters in ONE transaction, gated on
   * (`PROCESSING`, `claimToken`). False = token stale (row re-claimed); the
   * outcome is discarded and the current owner settles it.
   */
  abstract settleRow(
    rowId: string,
    jobId: string,
    claimToken: number,
    settlement: BatchOperationRowSettlement,
  ): Promise<boolean>;

  /**
   * Resets rows stuck PROCESSING past the window back to PENDING — only for
   * still-running jobs (bumping their token so stale workers cannot settle),
   * and abandons PROCESSING rows of terminal jobs. Returns the reset count.
   */
  abstract resetStuckRows(olderThanMs: number): Promise<number>;
}
