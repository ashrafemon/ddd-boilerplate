import { Module } from '@nestjs/common';
import { RedisModule as InfraRedisModule } from '@infrastructure/redis/redis.module';
import { ContextModule } from '@platform/platform-common/context/context.module';
import { CacheAdapter } from './adapters/cache.adapter';
import { CachePort } from './ports/cache.port';
import { RedisCacheAdapter } from './adapters/redis-cache.adapter';
import { DeleteCacheValueUseCase } from './use-cases/delete-cache-value.usecase';
import { GetCacheValueUseCase } from './use-cases/get-cache-value.usecase';
import { SetCacheValueUseCase } from './use-cases/set-cache-value.usecase';

/**
 * Platform cache module — a data cache for application code, backed by Redis
 * (design `common/01-cache`, Redis-only, no storage port, no registry).
 *
 * It caches **values a use case or a query needs**, not HTTP request/response
 * pairs: there is no route interceptor and no controller decorator here.
 * Caching belongs to the layer that owns the data — a business module wraps
 * this port in its own outbound port (e.g. `ReadCachePort`) and decides what to
 * cache, for how long, and when to invalidate.
 *
 * Business modules inject `CachePort` only — never a use case or the adapter.
 */
@Module({
  imports: [InfraRedisModule, ContextModule],
  providers: [
    // Outbound adapter → outbound port (use cases depend on the port)
    RedisCacheAdapter,

    // Use cases — one per file
    GetCacheValueUseCase,
    SetCacheValueUseCase,
    DeleteCacheValueUseCase,

    // Inbound port implementation → public port
    CacheAdapter,
    { provide: CachePort, useExisting: CacheAdapter },
  ],
  exports: [CachePort],
})
export class CacheModule {}
