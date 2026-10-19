import { registerAs } from '@nestjs/config';
import { booleanEnv, numericEnv, stringEnv } from './env.util';

export type IRedisConfig = { url: string };

/**
 * Cache behaviour config (design `common/01-cache`).
 *
 * `CACHE_ENABLED=false` turns get into MISS and set/delete into no-ops; the
 * app stays correct because the database is always authoritative.
 */
export interface ICacheConfig {
  enabled: boolean;
  defaultTtlMs: number;
  maxValueBytes: number;
  keyPrefix: string;
  keyVersion: string;
}

/**
 * Cache config — Redis is the only cache store (no driver selection).
 */
export default registerAs('cache', () => ({
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  enabled: booleanEnv('CACHE_ENABLED', true),
  defaultTtlMs: numericEnv('CACHE_DEFAULT_TTL_MS', 300_000),
  maxValueBytes: numericEnv('CACHE_MAX_VALUE_BYTES', 1_048_576),
  keyPrefix: stringEnv('CACHE_KEY_PREFIX', 'cache'),
  keyVersion: stringEnv('CACHE_KEY_VERSION', 'v1'),
}));
