import { registerAs } from '@nestjs/config';

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
  pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5_000),
  batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 50),
  maxAttempts: Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 10),
  retryBackoffBaseMs: Number(process.env.OUTBOX_RETRY_BACKOFF_BASE_MS ?? 1_000),
  cleanupOlderThanHours: Number(process.env.OUTBOX_CLEANUP_OLDER_THAN_HOURS ?? 24),
}));
