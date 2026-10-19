import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';
import { IInboxConfig } from '@platform/inbox/inbox.types';

/**
 * Inbox configuration (design 07).
 */
export default registerAs('inbox', (): IInboxConfig => ({
  claimLeaseMs: numericEnv('INBOX_CLAIM_LEASE_MS', 300_000),
  maxAttempts: numericEnv('INBOX_MAX_ATTEMPTS', 5),
  retryBaseDelayMs: numericEnv('INBOX_RETRY_BASE_DELAY_MS', 5_000),
  retryMaxDelayMs: numericEnv('INBOX_RETRY_MAX_DELAY_MS', 600_000),
  reconciliationIntervalMs: numericEnv('INBOX_RECONCILIATION_INTERVAL_MS', 60_000),
  processedRetentionMs: numericEnv('INBOX_PROCESSED_RETENTION_MS', 2_592_000_000),
}));
