import { ConfigService } from '@config/config.service';
import { ensureEnvLoaded, stringEnv } from '@config/env.util';
import { type MemcachedModuleOptions } from '@andreafspeziale/nestjs-memcached';

/**
 * Resolves the cache driver from CACHE_DRIVER env var.
 * Called at module-definition time (before Nest instantiates providers).
 */
export function resolveCacheDriver(): 'redis' | 'memcache' {
  ensureEnvLoaded();
  const driver = stringEnv('CACHE_DRIVER', 'redis');

  if (driver === 'memcache' && !stringEnv('MEMCACHED_HOST')) {
    throw new Error('CACHE_DRIVER=memcache requires MEMCACHED_HOST to be configured');
  }

  return driver === 'memcache' ? 'memcache' : 'redis';
}

/**
 * Builds Memcached module options from typed config.
 */
export function buildMemcachedOptions(config: ConfigService): MemcachedModuleOptions {
  const memcached = config.getMemcached();

  return {
    connections: [{ host: memcached.host, port: memcached.port }],
    ttl: Number(memcached.ttl ?? 0),
  };
}
