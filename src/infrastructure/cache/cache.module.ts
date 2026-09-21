import { ConfigService } from '@config/config.service';
import { Module, type DynamicModule } from '@nestjs/common';
import { MemcachedModule } from '@andreafspeziale/nestjs-memcached';
import { RedisService } from './redis/redis.service';
import { resolveCacheDriver, buildMemcachedOptions } from './cache.config';

/**
 * Infrastructure cache module — only client initialization/setup.
 *
 * Registers exactly one cache client, selected by `CACHE_DRIVER`.
 * Deliberately NOT `@Global()` — consumers import it explicitly.
 */
@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    const isMemcache = resolveCacheDriver() === 'memcache';

    return {
      module: CacheModule,
      imports: isMemcache
        ? [
            MemcachedModule.forRootAsync({
              inject: [ConfigService],
              useFactory: buildMemcachedOptions,
            }),
          ]
        : [],
      providers: isMemcache ? [] : [RedisService],
      exports: isMemcache ? [] : [RedisService],
    };
  }
}
