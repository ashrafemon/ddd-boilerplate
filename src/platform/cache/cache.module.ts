import { resolveCacheDriver } from '@infrastructure/cache/cache.config';
import { CacheModule as InfraCacheModule } from '@infrastructure/cache/cache.module';
import { Module } from '@nestjs/common';
import { MemcachedCacheAdapter } from './adapters/memcached-cache.adapter';
import { RedisCacheAdapter } from './adapters/redis-cache.adapter';
import { CacheKeyBuilder } from './cache-key.builder';
import { CacheService } from './cache.service';
import { CacheKeyBuilderPort } from './ports/cache-key-builder.port';
import { CacheStoragePort } from './ports/cache-storage.port';
import { CachePort } from './ports/cache.port';

/**
 * Platform cache module — provides CachePort backed by Redis or Memcached.
 *
 * Business modules inject CachePort only — never the adapter directly.
 */
const StorageAdapter =
  resolveCacheDriver() === 'memcache' ? MemcachedCacheAdapter : RedisCacheAdapter;

@Module({
  imports: [InfraCacheModule.forRoot()],
  providers: [
    StorageAdapter,
    CacheKeyBuilder,
    CacheService,
    { provide: CacheStoragePort, useExisting: StorageAdapter },
    { provide: CacheKeyBuilderPort, useExisting: CacheKeyBuilder },
    { provide: CachePort, useExisting: CacheService },
  ],
  exports: [CachePort, CacheKeyBuilderPort],
})
export class CacheModule {}
