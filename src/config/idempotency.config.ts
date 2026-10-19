import { registerAs } from '@nestjs/config';
import { numericEnv, stringEnv } from './env.util';
import { IIdempotencyConfig } from '@platform/idempotency/idempotency.types';

/**
 * Idempotency configuration (design `common/02-idempotency`).
 */
export default registerAs('idempotency', (): IIdempotencyConfig => ({
  ttlMs: numericEnv('IDEMPOTENCY_TTL_MS', 86_400_000),
  claimLeaseMs: numericEnv('IDEMPOTENCY_CLAIM_LEASE_MS', 300_000),
  reconciliationIntervalMs: numericEnv('IDEMPOTENCY_RECONCILIATION_INTERVAL_MS', 3_600_000),
  redisPrefix: stringEnv('IDEMPOTENCY_REDIS_PREFIX', 'idempotency'),
}));
