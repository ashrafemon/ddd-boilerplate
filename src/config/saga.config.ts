import { registerAs } from '@nestjs/config';
import { numericEnv } from '@common/application/utils/env.util';
import { ISagaConfig } from '@platform/platform-common/saga/types/saga.types';

/**
 * Saga process orchestration configuration (design 08).
 */
export default registerAs('saga', (): ISagaConfig => ({
  workerLeaseSeconds: numericEnv('SAGA_WORKER_LEASE_SECONDS', 60),
  claimBatchSize: numericEnv('SAGA_CLAIM_BATCH_SIZE', 20),
  fairnessCap: numericEnv('SAGA_FAIRNESS_CAP', 5),
  sweepIntervalMs: numericEnv('SAGA_SWEEP_INTERVAL_MS', 10_000),
  sweepBatchSize: numericEnv('SAGA_SWEEP_BATCH_SIZE', 200),
  retryBaseDelayMs: numericEnv('SAGA_RETRY_BASE_DELAY_MS', 1_000),
  retryMaxDelayMs: numericEnv('SAGA_RETRY_MAX_DELAY_MS', 600_000),
  defaultMaxAttempts: numericEnv('SAGA_DEFAULT_MAX_ATTEMPTS', 5),
  inboxRetentionDays: numericEnv('SAGA_INBOX_RETENTION_DAYS', 30),
  outboxPollIntervalMs: numericEnv('SAGA_OUTBOX_POLL_INTERVAL_MS', 10_000),
}));
