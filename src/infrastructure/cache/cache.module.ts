import { MemcachedModule } from '@andreafspeziale/nestjs-memcached';
import { Global, type DynamicModule, type Provider, Module } from '@nestjs/common';
import { CachePort } from '@shared-kernel/ports/cache/cache.port';
import { MemcachedCacheAdapter } from './memcached/memcached-cache.adapter';
import { MemcachedService } from './memcached/memcached.service';
import { RedisCacheAdapter } from './redis/redis-cache.adapter';
import { RedisService } from './redis/redis.service';

/**
 * Cache infrastructure — initializes the client selected by `CACHE_DRIVER`
 * (redis or memcache) in the NestJS dynamic-module style. Only the configured
 * driver's client and adapter are registered, so no connection is opened for
 * the unused one.
 */
@Global()
@Module({})
export class CacheModule {
  static forRootAsync(): DynamicModule {
    const driver = process.env.CACHE_DRIVER ?? 'redis';
    const isMemcache = driver === 'memcache';

    const cachePortProvider: Provider = isMemcache
      ? { provide: CachePort, useClass: MemcachedCacheAdapter }
      : { provide: CachePort, useClass: RedisCacheAdapter };

    const clientProviders: Provider[] = isMemcache ? [MemcachedService] : [RedisService];

    return {
      module: CacheModule,
      global: true,
      imports: isMemcache
        ? [
            MemcachedModule.forRootAsync({
              inject: [MemcachedService],
              useFactory: (service: MemcachedService) => service.createMemcachedOptions(),
            }),
          ]
        : [],
      providers: [...clientProviders, cachePortProvider],
      exports: [CachePort],
    };
  }
}
