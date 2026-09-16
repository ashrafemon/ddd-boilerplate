import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IIdempotencyConfig = {
  /** Lifetime of a reservation row (replay window + stale IN_PROGRESS takeover delay). */
  ttlMs: number;
};

/**
 * Idempotency ledger config — replay window for @Idempotent() reservations.
 * Consumed only by platform/idempotency.
 */
export default registerAs('idempotency', (): IIdempotencyConfig => ({
  ttlMs: numericEnv('IDEMPOTENCY_TTL_MS', 24 * 60 * 60 * 1000),
}));
