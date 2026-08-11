import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { MemcachedService } from '@andreafspeziale/nestjs-memcached';
import { CachePort } from '../../../shared-kernel/ports/cache/cache.port';

/**
 * Memcached-backed cache adapter built on @andreafspeziale/nestjs-memcached.
 */
@Injectable()
export class MemcachedCacheAdapter implements CachePort, OnModuleDestroy {
  constructor(private readonly memcached: MemcachedService) {}

  public async get<T>(key: string): Promise<T | null> {
    return this.memcached.get<T>(key);
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.memcached.set(key, value, ttlSeconds !== undefined ? { ttl: ttlSeconds } : undefined);
  }

  public async delete(key: string): Promise<void> {
    await this.memcached.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    return (await this.memcached.get<unknown>(key)) !== null;
  }

  public onModuleDestroy(): void {
    this.memcached.end();
  }
}
