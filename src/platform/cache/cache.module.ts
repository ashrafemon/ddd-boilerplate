import { Module } from '@nestjs/common';
import { MemcachedCacheAdapter } from './adapters/memcached-cache.adapter';
import { RedisCacheAdapter } from './adapters/redis-cache.adapter';
import { CachePort } from './ports/cache.port';

/**
 * Platform cache module — provides the CachePort adapter backed by
 * the Redis or Memcached client initialized in the infrastructure layer.
 */
@Module({
  providers: [
    MemcachedCacheAdapter,
    RedisCacheAdapter,
    { provide: CachePort, useClass: RedisCacheAdapter },
  ],
  exports: [CachePort],
})
export class CacheModule {}
