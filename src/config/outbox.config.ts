import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IOutboxConfig = {
  pollIntervalMs: number;
  batchSize: number;
  maxAttempts: number;
  /** Base delay (ms) for exponential backoff: delay = base * 2^(attempts-1). */
  retryBackoffBaseMs: number;
  /** Maximum retry delay (ms) — backoff is capped at this value. */
  retryMaxDelayMs: number;
  /** Claim lease: CLAIMED rows older than this are reconciled to PENDING. */
  claimLeaseMs: number;
  /** Delete PUBLISHED rows older than this many hours. */
  cleanupOlderThanHours: number;
};

/**
 * Transactional outbox config — dispatcher cadence and retry limits.
 */
export default registerAs('outbox', () => ({
  pollIntervalMs: numericEnv('OUTBOX_POLL_INTERVAL_MS', 5_000),
  batchSize: numericEnv('OUTBOX_BATCH_SIZE', 50),
  maxAttempts: numericEnv('OUTBOX_MAX_ATTEMPTS', 10),
  retryBackoffBaseMs: numericEnv('OUTBOX_RETRY_BACKOFF_BASE_MS', 1_000),
  retryMaxDelayMs: numericEnv('OUTBOX_RETRY_MAX_DELAY_MS', 600_000),
  claimLeaseMs: numericEnv('OUTBOX_CLAIM_LEASE_MS', 120_000),
  cleanupOlderThanHours: numericEnv('OUTBOX_CLEANUP_OLDER_THAN_HOURS', 24),
}));
