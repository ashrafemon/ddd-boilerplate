import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

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
 * Redis config — used for caching, distributed locks and rate limiting.
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
}));
