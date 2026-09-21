import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export interface ILockingConfig {
  defaultLeaseMs: number;
  minLeaseMs: number;
  maxLeaseMs: number;
  renewIntervalMs: number;
}

/**
 * Distributed Lock configuration.
 */
export default registerAs('locking', (): ILockingConfig => ({
  defaultLeaseMs: numericEnv('LOCK_DEFAULT_LEASE_MS', 30_000),
  minLeaseMs: numericEnv('LOCK_MIN_LEASE_MS', 5_000),
  maxLeaseMs: numericEnv('LOCK_MAX_LEASE_MS', 300_000),
  renewIntervalMs: numericEnv('LOCK_RENEW_INTERVAL_MS', 10_000),
}));
