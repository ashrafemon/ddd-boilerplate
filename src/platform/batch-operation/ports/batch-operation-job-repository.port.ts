import { PageResult } from '@shared-kernel/types/pagination';
import {
  BatchOperationJobRecord,
  BatchOperationListQuery,
  BatchOperationRowOutcome,
  NewBatchOperationJob,
} from '../batch-operation.types';

/**
 * Persistence of batch_operation_jobs (header). createJobWithRows also writes
 * Pending rows in the SAME transaction — no job without its rows.
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

  /** Marks the job RUNNING and stamps started_at, if it was still PENDING. */
  abstract markJobRunning(jobId: string): Promise<void>;

  /** Atomically bumps processed_records + the matching outcome counter. */
  abstract incrementProgress(
    jobId: string,
    outcome: BatchOperationRowOutcome,
  ): Promise<BatchOperationJobRecord>;

  /** Terminal status from counters (COMPLETED / COMPLETED_WITH_ERRORS / FAILED) + completed_at. */
  abstract finaliseJob(jobId: string): Promise<BatchOperationJobRecord>;

  /** Sets status=CANCELLED + completed_at once the last in-flight chunk has finished. */
  abstract finaliseCancelled(jobId: string): Promise<BatchOperationJobRecord>;

  abstract setCancelRequested(jobId: string): Promise<void>;

  abstract isCancelRequested(jobId: string): Promise<boolean>;

  /** Non-terminal jobs (PENDING/RUNNING, not cancel-requested) that still have PENDING rows. */
  abstract findResumableJobs(): Promise<BatchOperationJobRecord[]>;
}
