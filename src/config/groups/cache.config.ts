import { z } from 'zod';
import { booleanFromString, numberFromString } from '../env-helpers';

/**
 * Cache client group — Redis and Memcached credentials.
 */
export const cacheConfigSchema = z.object({
  REDIS_ENABLED: booleanFromString(true),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: numberFromString(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: numberFromString(0),
  REDIS_TTL_SECONDS: numberFromString(300),

  MEMCACHED_ENABLED: booleanFromString(false),
  MEMCACHED_HOST: z.string().default('localhost'),
  MEMCACHED_PORT: numberFromString(11211),
  MEMCACHED_TTL_SECONDS: numberFromString(300),
});

export type CacheConfig = z.infer<typeof cacheConfigSchema>;
