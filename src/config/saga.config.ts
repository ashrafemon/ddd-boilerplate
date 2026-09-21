import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';
import { ISagaConfig } from '@platform/saga/saga.types';

/**
 * Saga process orchestration configuration.
 */
export default registerAs('saga', (): ISagaConfig => ({
  defaultTimeoutMs: numericEnv('SAGA_DEFAULT_TIMEOUT_MS', 300_000),
  defaultMaxAttempts: numericEnv('SAGA_DEFAULT_MAX_ATTEMPTS', 5),
  retryBaseDelayMs: numericEnv('SAGA_RETRY_BASE_DELAY_MS', 1_000),
  retryMaxDelayMs: numericEnv('SAGA_RETRY_MAX_DELAY_MS', 600_000),
  reconciliationIntervalMs: numericEnv('SAGA_RECONCILIATION_INTERVAL_MS', 60_000),
  stepClaimLeaseMs: numericEnv('SAGA_STEP_CLAIM_LEASE_MS', 60_000),
  maxConcurrentInstances: numericEnv('SAGA_MAX_CONCURRENT_INSTANCES', 100),
  maxConcurrentSteps: numericEnv('SAGA_MAX_CONCURRENT_STEPS', 20),
}));
