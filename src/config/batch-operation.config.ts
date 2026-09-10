import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IBatchOperationConfig = {
  /** Soft cap on records per job — a submission above this is rejected 422. */
  maxRecordsPerJob: number;
  /** <= this many records runs Sync (in the HTTP request); above it runs Async. */
  syncThreshold: number;
  /** Rows per Async chunk. Redelivery only ever re-checks one chunk. */
  chunkSize: number;
  /** Async chunks processed in parallel per node. Bounded by the DB pool. */
  workerConcurrency: number;
  /** BullMQ attempts per chunk before dead-letter / operator alert. */
  chunkAttempts: number;
  /** A row Processing longer than this is treated as an orphaned claim. */
  reconciliationWindowMs: number;
  /** result_snapshot larger than this is dropped (a marker is stored instead). */
  resultSnapshotMaxBytes: number;
};

/**
 * Batch Operation config — selection limits, the Sync/Async threshold, chunk
 * sizing and the stuck-row reconciliation window. Consumed only by
 * platform/batch-operation; no domain module reads this directly.
 */
export default registerAs('batchOperation', (): IBatchOperationConfig => ({
  maxRecordsPerJob: numericEnv('BATCH_OPERATION_MAX_RECORDS_PER_JOB', 5_000),
  syncThreshold: numericEnv('BATCH_OPERATION_SYNC_THRESHOLD', 20),
  chunkSize: numericEnv('BATCH_OPERATION_CHUNK_SIZE', 50),
  workerConcurrency: numericEnv('BATCH_OPERATION_WORKER_CONCURRENCY', 5),
  chunkAttempts: numericEnv('BATCH_OPERATION_CHUNK_ATTEMPTS', 3),
  reconciliationWindowMs: numericEnv('BATCH_OPERATION_RECONCILIATION_WINDOW_MS', 300_000),
  resultSnapshotMaxBytes: numericEnv('BATCH_OPERATION_RESULT_SNAPSHOT_MAX_BYTES', 65_536),
}));
