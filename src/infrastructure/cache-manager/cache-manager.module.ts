import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { ConfigService } from '@config/config.service';
import { CacheManagerService } from './cache-manager.service';

/**
 * HTTP response cache client (`@nestjs/cache-manager`), separate from the
 * platform data cache.
 *
 * Initialization only: the store is built from the typed `@config` facade and
 * re-exported so the HTTP interceptor can inject `CACHE_MANAGER`. It holds what
 * a controller returned for a URL — never domain data; that is `CachePort`.
 *
 * The default store is in-process (memory), which is what a response cache
 * needs: entries are short-lived and per route. Sharing them across instances
 * would need an external Keyv store wired here, and the same TTL.
 */
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.getHttpCache().ttlMs,
      }),
    }),
  ],
  providers: [CacheManagerService],
  exports: [NestCacheModule, CacheManagerService],
})
export class CacheManagerModule {}
