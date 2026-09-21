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
import { GetCacheValueUseCase } from './usecases/get-cache-value.usecase';
import { GetCacheValueWithResultUseCase } from './usecases/get-cache-value-with-result.usecase';
import { SetCacheValueUseCase } from './usecases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from './usecases/delete-cache-value.usecase';
import { ExistsCacheValueUseCase } from './usecases/exists-cache-value.usecase';
import { GetOrSetCacheValueUseCase } from './usecases/get-or-set-cache-value.usecase';

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
    // Adapter — low-level storage
    StorageAdapter,
    { provide: CacheStoragePort, useExisting: StorageAdapter },

    // Key builder
    CacheKeyBuilder,
    { provide: CacheKeyBuilderPort, useExisting: CacheKeyBuilder },

    // Use cases — one per file
    GetCacheValueUseCase,
    GetCacheValueWithResultUseCase,
    SetCacheValueUseCase,
    DeleteCacheValueUseCase,
    ExistsCacheValueUseCase,
    GetOrSetCacheValueUseCase,

    // Facade → public port
    CacheService,
    { provide: CachePort, useExisting: CacheService },
  ],
  exports: [CachePort, CacheKeyBuilderPort],
})
export class CacheModule {}
