import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type ISchedulerConfig = {
  pollIntervalMs: number;
  batchSize: number;
  lockTtlMs: number;
  reconciliationIntervalMs: number;
  workerConcurrency: number;
  jobAttempts: number;
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
}));
