import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RedisModule as InfraRedisModule } from '@infrastructure/redis/redis.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { RedisCacheAdapter } from './adapters/redis-cache.adapter';
import { CacheService } from './services/cache.service';
import { CachePort } from './ports/cache.port';
import { CacheResponseInterceptor } from './interceptors/cache-response.interceptor';
import { CacheableInterceptor } from './interceptors/cacheable.interceptor';
import { CacheEvictInterceptor } from './interceptors/cache-evict.interceptor';
import { GetCacheValueUseCase } from './usecases/get-cache-value.usecase';
import { SetCacheValueUseCase } from './usecases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from './usecases/delete-cache-value.usecase';

/**
 * Platform cache module — provides CachePort backed by Redis
 * (design `common/01-cache`, Redis-only, no storage port, no registry).
 *
 * Business modules inject CachePort only — never the adapter directly.
 *
 * `CacheableInterceptor` / `CacheEvictInterceptor` are installed as global
 * APP_INTERCEPTORs and are no-ops unless a route carries `@Cacheable()` /
 * `@CacheEvict()`.
 */
@Module({
  imports: [InfraRedisModule, ContextModule],
  providers: [
    // Concrete Redis adapter (injected directly into the use cases)
    RedisCacheAdapter,

    // Use cases — one per file
    GetCacheValueUseCase,
    SetCacheValueUseCase,
    DeleteCacheValueUseCase,

    // Facade → public port
    CacheService,
    { provide: CachePort, useExisting: CacheService },

    // HTTP read cache — scoped per route with @Cacheable()
    CacheResponseInterceptor,
    CacheableInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: CacheableInterceptor },

    // HTTP cache eviction — scoped per route with @CacheEvict()
    CacheEvictInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: CacheEvictInterceptor },
  ],
  exports: [CachePort, CacheResponseInterceptor, CacheableInterceptor, CacheEvictInterceptor],
})
export class CacheModule {}
