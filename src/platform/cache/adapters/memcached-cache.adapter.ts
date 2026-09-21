import { MemcachedService } from '@andreafspeziale/nestjs-memcached';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CacheStoragePort } from '@platform/cache/ports/cache-storage.port';

/**
 * Memcached-backed cache storage adapter built on @andreafspeziale/nestjs-memcached.
 *
 * Implements CacheStoragePort (the internal storage abstraction), NOT the
 * public CachePort. Business modules never see this class.
 */
@Injectable()
export class MemcachedCacheAdapter implements CacheStoragePort {
  private readonly logger = new Logger(MemcachedCacheAdapter.name);

  constructor(private readonly memcached: MemcachedService) {}

  public onModuleDestroy(): void {
    this.memcached.end();
  }

  public async get(key: string): Promise<string | null> {
    try {
      const raw = await this.memcached.get<string>(key);
      return raw ?? null;
    } catch (error) {
      this.logger.error('memcache-get-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Memcache get failed');
    }
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.memcached.set(
        key,
        value,
        ttlSeconds > 0 ? { ttl: ttlSeconds } : undefined,
      );
    } catch (error) {
      this.logger.error('memcache-set-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Memcache set failed');
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.memcached.del(key);
    } catch (error) {
      this.logger.error('memcache-delete-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Memcache delete failed');
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const raw = await this.memcached.get<string>(key);
      return raw !== null && raw !== undefined;
    } catch (error) {
      this.logger.error('memcache-exists-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Memcache exists failed');
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
