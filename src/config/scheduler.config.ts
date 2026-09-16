import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type ISchedulerConfig = {
  pollIntervalMs: number;
  batchSize: number;
  lockTtlMs: number;
  reconciliationIntervalMs: number;
  workerConcurrency: number;
  jobAttempts: number;
  /** Handler-failure attempts before a schedule is SUSPENDED (manual revival). */
  maxRetries: number;
  /** Base delay for exponential retry backoff applied to nextRunAt. */
  retryBackoffBaseMs: number;
};

/**
 * Scheduler config — shared infrastructure poller cadence, lock TTL, and BullMQ worker.
 * Consumed only by platform/scheduler; worker concurrency is also read by
 * `@Processor` from SCHEDULER_WORKER_CONCURRENCY at class load.
 */
export default registerAs('scheduler', (): ISchedulerConfig => ({
  pollIntervalMs: numericEnv('SCHEDULER_POLL_INTERVAL_MS', 30_000),
  batchSize: numericEnv('SCHEDULER_BATCH_SIZE', 20),
  lockTtlMs: numericEnv('SCHEDULER_LOCK_TTL_MS', 300_000),
  reconciliationIntervalMs: numericEnv('SCHEDULER_RECONCILIATION_INTERVAL_MS', 300_000),
  workerConcurrency: numericEnv('SCHEDULER_WORKER_CONCURRENCY', 5),
  jobAttempts: numericEnv('SCHEDULER_JOB_ATTEMPTS', 3),
  maxRetries: numericEnv('SCHEDULER_MAX_RETRIES', 5),
  retryBackoffBaseMs: numericEnv('SCHEDULER_RETRY_BACKOFF_BASE_MS', 60_000),
}));
