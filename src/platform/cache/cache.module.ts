import { Module } from '@nestjs/common';
import { INFRA_CACHE_MODULE, resolveCacheDriver } from '@infrastructure/cache/cache.module';
import { MemcachedCacheAdapter } from './adapters/memcached-cache.adapter';
import { RedisCacheAdapter } from './adapters/redis-cache.adapter';
import { CachePort } from './ports/cache.port';

/**
 * Platform cache module — provides the CachePort adapter backed by the Redis
 * or Memcached client initialized in the infrastructure layer. The same
 * resolver the infrastructure layer uses decides the driver, so exactly one
 * adapter is instantiated and it always matches the registered client.
 */
const CacheAdapter =
  resolveCacheDriver() === 'memcache' ? MemcachedCacheAdapter : RedisCacheAdapter;

@Module({
  imports: [INFRA_CACHE_MODULE],
  providers: [CacheAdapter, { provide: CachePort, useExisting: CacheAdapter }],
  exports: [CachePort],
})
export class CacheModule {}
