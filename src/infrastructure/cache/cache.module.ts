import { ConfigService } from '@config/config.service';
import { ensureEnvLoaded, stringEnv } from '@config/env.util';
import { Module, type DynamicModule } from '@nestjs/common';
import { MemcachedModule, type MemcachedModuleOptions } from '@andreafspeziale/nestjs-memcached';
import { RedisService } from './redis/redis.service';

/**
 * Infrastructure cache module — only client initialization/setup.
 *
 * Registers exactly one cache client, selected by `CACHE_DRIVER`. The options
 * builder is a plain function injected with the global ConfigService so the
 * third-party module never has to see providers declared here.
 */
export function buildMemcachedOptions(config: ConfigService): MemcachedModuleOptions {
  const memcached = config.getMemcached();

  return {
    connections: [{ host: memcached.host, port: memcached.port }],
    ttl: Number(memcached.ttl ?? 0),
  };
}

export function resolveCacheDriver(): 'redis' | 'memcache' {
  ensureEnvLoaded();
  const driver = stringEnv('CACHE_DRIVER', 'redis');

  if (driver === 'memcache' && !stringEnv('MEMCACHED_HOST')) {
    throw new Error('CACHE_DRIVER=memcache requires MEMCACHED_HOST to be configured');
  }

  return driver === 'memcache' ? 'memcache' : 'redis';
}

@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    const isMemcache = resolveCacheDriver() === 'memcache';
    const clientProvider = isMemcache ? undefined : RedisService;

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
      providers: clientProvider ? [clientProvider] : [],
      exports: clientProvider ? [clientProvider] : [],
    };
  }
}

/**
 * The single shared cache-client definition. Infrastructure imports it, and the
 * platform cache adapters import the very same object — calling `forRoot()`
 * twice would build two independent clients.
 */
export const INFRA_CACHE_MODULE = CacheModule.forRoot();
