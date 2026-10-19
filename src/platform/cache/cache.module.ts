import { Module } from '@nestjs/common';
import { CacheModule as InfraCacheModule } from '@infrastructure/cache/cache.module';
import { RedisCacheAdapter } from './adapters/redis-cache.adapter';
import { CacheService } from './services/cache.service';
import { CachePort } from './ports/cache.port';
import { GetCacheValueUseCase } from './usecases/get-cache-value.usecase';
import { SetCacheValueUseCase } from './usecases/set-cache-value.usecase';
import { DeleteCacheValueUseCase } from './usecases/delete-cache-value.usecase';

/**
 * Platform cache module — provides CachePort backed by Redis
 * (design `common/01-cache`, Redis-only, no storage port, no registry).
 *
 * Business modules inject CachePort only — never the adapter directly.
 */
@Module({
  imports: [InfraCacheModule.forRoot()],
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
  ],
  exports: [CachePort],
})
export class CacheModule {}
