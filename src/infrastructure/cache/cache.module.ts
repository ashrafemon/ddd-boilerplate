import { DynamicModule, Module } from '@nestjs/common';
import { MemcachedModule } from '@andreafspeziale/nestjs-memcached';
import { envBoolean, envNumber, envString } from '../../config/env-helpers';
import { CachePort } from '../../shared-kernel/ports/cache/cache.port';
import { MemcachedCacheAdapter } from './memcached/memcached-cache.adapter';
import { NullCacheAdapter } from './null-cache.adapter';
import { RedisCacheAdapter } from './redis/redis-cache.adapter';

/**
 * Aggregates the cache transports behind a single CachePort.
 *
 * Selection order:
 *   1. Redis when REDIS_ENABLED=true (default).
 *   2. Memcached when REDIS_ENABLED=false and MEMCACHED_ENABLED=true.
 *   3. NullCacheAdapter otherwise.
 *
 * The decision is made at bootstrap time from the environment.
 */
@Module({})
export class CacheModule {
  public static forRoot(): DynamicModule {
    const redisEnabled = envBoolean('REDIS_ENABLED', true);
    const memcachedEnabled = envBoolean('MEMCACHED_ENABLED', false);

    if (redisEnabled) {
      return {
        module: CacheModule,
        global: true,
        providers: [{ provide: CachePort, useClass: RedisCacheAdapter }],
        exports: [CachePort],
      };
    }

    if (memcachedEnabled) {
      return {
        module: CacheModule,
        global: true,
        imports: [
          MemcachedModule.forRootAsync({
            useFactory: () => ({
              connections: [
                {
                  host: envString('MEMCACHED_HOST', 'localhost'),
                  port: envNumber('MEMCACHED_PORT', 11211),
                },
              ],
              ttl: envNumber('MEMCACHED_TTL_SECONDS', 300),
            }),
          }),
        ],
        providers: [{ provide: CachePort, useClass: MemcachedCacheAdapter }],
        exports: [CachePort],
      };
    }

    return {
      module: CacheModule,
      global: true,
      providers: [{ provide: CachePort, useClass: NullCacheAdapter }],
      exports: [CachePort],
    };
  }
}
