import { MemcachedService } from '@andreafspeziale/nestjs-memcached';
import { Injectable } from '@nestjs/common';
import { InfrastructureException } from '@shared-kernel/exceptions/infrastructure.exception';
import { CachePort } from '@shared-kernel/ports/cache/cache.port';

/**
 * Memcached-backed cache adapter built on @andreafspeziale/nestjs-memcached.
 */
@Injectable()
export class MemcachedCacheAdapter implements CachePort {
  constructor(private readonly memcached: MemcachedService) {}

  public onModuleDestroy(): void {
    this.memcached.end();
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      return this.memcached.get<T>(key);
    } catch (error) {
      throw new InfrastructureException('Memcache get failed', { key, cause: messageOf(error) });
    }
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.memcached.set(
        key,
        value,
        ttlSeconds !== undefined ? { ttl: ttlSeconds } : undefined,
      );
    } catch (error) {
      throw new InfrastructureException('Memcache get failed', { key, cause: messageOf(error) });
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.memcached.del(key);
    } catch (error) {
      throw new InfrastructureException('Memcache get failed', { key, cause: messageOf(error) });
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      return (await this.memcached.get<unknown>(key)) !== null;
    } catch (error) {
      throw new InfrastructureException('Memcache get failed', { key, cause: messageOf(error) });
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
