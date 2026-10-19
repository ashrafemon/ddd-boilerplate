import { registerAs } from '@nestjs/config';
import { booleanEnv, numericEnv, stringEnv } from './env.util';

export type ICacheDriver = 'redis' | 'memcache';
export type IRedisConfig = { url: string };
export type IMemcachedConfig = {
  host: string;
  port: number;
  ttl?: number;
  username?: string;
  password?: string;
};

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
 * Cache config — driver selection + behaviour. Redis is used for caching,
 * distributed locks and rate limiting.
 */
export default registerAs('cache', () => ({
  driver: process.env.CACHE_DRIVER ?? 'redis',
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  memcached: {
    host: process.env.MEMCACHED_HOST ?? '',
    port: numericEnv('MEMCACHED_PORT', 11211),
    username: process.env.MEMCACHED_USER ?? '',
    password: process.env.MEMCACHED_PASSWORD ?? '',
    ttl: numericEnv('MEMCACHED_TTL_SECONDS', 300),
  },
  enabled: booleanEnv('CACHE_ENABLED', true),
  defaultTtlMs: numericEnv('CACHE_DEFAULT_TTL_MS', 300_000),
  maxValueBytes: numericEnv('CACHE_MAX_VALUE_BYTES', 1_048_576),
  keyPrefix: stringEnv('CACHE_KEY_PREFIX', 'cache'),
  keyVersion: stringEnv('CACHE_KEY_VERSION', 'v1'),
}));
