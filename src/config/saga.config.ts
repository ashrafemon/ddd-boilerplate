import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';
import { ISagaConfig } from '@platform/saga/saga.types';

/**
 * Saga process orchestration configuration (design 08).
 */
export default registerAs('saga', (): ISagaConfig => ({
  workerLeaseSeconds: numericEnv('SAGA_WORKER_LEASE_SECONDS', 60),
  claimBatchSize: numericEnv('SAGA_CLAIM_BATCH_SIZE', 20),
  fairnessCap: numericEnv('SAGA_FAIRNESS_CAP', 5),
  sweepIntervalMs: numericEnv('SAGA_SWEEP_INTERVAL_MS', 10_000),
  retryBaseDelayMs: numericEnv('SAGA_RETRY_BASE_DELAY_MS', 1_000),
  retryMaxDelayMs: numericEnv('SAGA_RETRY_MAX_DELAY_MS', 600_000),
  defaultMaxAttempts: numericEnv('SAGA_DEFAULT_MAX_ATTEMPTS', 5),
  inboxRetentionDays: numericEnv('SAGA_INBOX_RETENTION_DAYS', 30),
}));
