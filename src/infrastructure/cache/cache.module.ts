import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { MemcachedModule } from '@andreafspeziale/nestjs-memcached';
import { MemcachedService } from './memcached/memcached.service';
import { RedisService } from './redis/redis.service';

/**
 * Infrastructure cache module — only client initialization/setup.
 *
 * Registers the cache client selected by `CACHE_DRIVER` (redis or memcache).
 * The platform layer provides the CachePort adapter.
 */

@Module({})
export class CacheModule {
  static forRootAsync(): DynamicModule {
    const driver = process.env.CACHE_DRIVER ?? 'redis';
    const isMemcache = driver === 'memcache';

    const clientProviders: Provider[] = isMemcache ? [MemcachedService] : [RedisService];

    return {
      module: CacheModule,
      imports: isMemcache
        ? [
            MemcachedModule.forRootAsync({
              inject: [MemcachedService],
              useFactory: (service: MemcachedService) => service.createMemcachedOptions(),
            }),
          ]
        : [],
      providers: clientProviders,
      exports: clientProviders,
    };
  }
}
