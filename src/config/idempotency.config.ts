import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';
import { IIdempotencyConfig } from '@platform/idempotency/idempotency.types';

/**
 * Idempotency configuration.
 */
export default registerAs('idempotency', (): IIdempotencyConfig => ({
  ttlMs: numericEnv('IDEMPOTENCY_TTL_MS', 86_400_000),
  claimLeaseMs: numericEnv('IDEMPOTENCY_CLAIM_LEASE_MS', 300_000),
  reconciliationIntervalMs: numericEnv('IDEMPOTENCY_RECONCILIATION_INTERVAL_MS', 3_600_000),
}));
