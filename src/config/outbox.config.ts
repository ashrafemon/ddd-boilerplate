import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IOutboxConfig = {
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  retryBackoffBaseMs: number;
  cleanupOlderThanHours: number;
};

/**
 * Transactional outbox config — publisher worker cadence and retry limits.
 */
export default registerAs('outbox', () => ({
  pollIntervalMs: numericEnv('OUTBOX_POLL_INTERVAL_MS', 5_000),
  batchSize: numericEnv('OUTBOX_BATCH_SIZE', 50),
  maxAttempts: numericEnv('OUTBOX_MAX_ATTEMPTS', 10),
  retryBackoffBaseMs: numericEnv('OUTBOX_RETRY_BACKOFF_BASE_MS', 1_000),
  cleanupOlderThanHours: numericEnv('OUTBOX_CLEANUP_OLDER_THAN_HOURS', 24),
}));
