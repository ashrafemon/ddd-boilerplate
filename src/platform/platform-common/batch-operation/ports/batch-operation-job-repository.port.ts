import { PageResult } from '@shared-kernel/types/pagination';
import {
  BatchOperationJobRecord,
  BatchOperationListQuery,
  NewBatchOperationJob,
} from '../batch-operation.types';

/**
 * Persistence of batch_operation_jobs (header). createJobWithRows also writes
 * Pending rows in the SAME transaction — no job without its rows.
 *
 * Row counters are bumped exclusively by the row repository's `settleRow`
 * (claim-token gated, same transaction) — the header is never decremented by
 * stale workers.
 */
export abstract class BatchOperationJobRepositoryPort {
  /**
   * Writes the job header and one Pending row per entityId in ONE transaction.
   * Returns the job with its rows populated.
   */
  abstract createJobWithRows(
    job: NewBatchOperationJob,
    entityIds: string[],
  ): Promise<BatchOperationJobRecord>;

  abstract findJob(jobId: string): Promise<BatchOperationJobRecord | null>;

  /** Job header plus every row — used by Sync's final response. */
  abstract findJobWithRows(jobId: string): Promise<BatchOperationJobRecord | null>;

  abstract listJobs(query: BatchOperationListQuery): Promise<PageResult<BatchOperationJobRecord>>;

  /** Marks the job RUNNING and stamps started_at, if it was still PENDING (and not cancelled). */
  abstract markJobRunning(jobId: string): Promise<void>;

  /**
   * Terminal status from counters (COMPLETED / COMPLETED_WITH_ERRORS / FAILED)
   * + completed_at. CAS: only non-terminal rows flip; returns null when the
   * job was already finalised elsewhere (duplicate event guard).
   */
  abstract finaliseJob(jobId: string): Promise<BatchOperationJobRecord | null>;

  /** Sets status=CANCELLED + completed_at once the last in-flight chunk settled. */
  abstract finaliseCancelled(jobId: string): Promise<BatchOperationJobRecord | null>;

  /** Enqueue/transport failure right after creation: PENDING -> FAILED, not COMPLETED. */
  abstract markJobFailed(jobId: string): Promise<void>;

  abstract setCancelRequested(jobId: string): Promise<void>;

  abstract isCancelRequested(jobId: string): Promise<boolean>;

  /**
   * Async jobs (PENDING/RUNNING, not cancel-requested) that still have PENDING
   * rows — reconciliation re-dispatches their chunks.
   */
  abstract findResumableJobs(): Promise<BatchOperationJobRecord[]>;

  /** Header counters re-derived from row truth for every non-terminal job. */
  abstract recountJobCounters(): Promise<number>;

  /** Non-terminal jobs whose rows are all settled — safe to finalise now. */
  abstract findCompletableJobs(): Promise<BatchOperationJobRecord[]>;
}
