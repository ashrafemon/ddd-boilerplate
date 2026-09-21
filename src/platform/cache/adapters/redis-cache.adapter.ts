import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CacheStoragePort } from '@platform/cache/ports/cache-storage.port';
import { RedisService } from '@infrastructure/cache/redis/redis.service';

/**
 * Redis-backed cache storage adapter.
 *
 * Implements CacheStoragePort (the internal storage abstraction), NOT the
 * public CachePort. Business modules never see this class.
 *
 * Works with raw strings only — serialization is handled by the CacheService.
 */
@Injectable()
export class RedisCacheAdapter implements CacheStoragePort {
  private readonly logger = new Logger(RedisCacheAdapter.name);

  constructor(private readonly redisService: RedisService) {}

  public async get(key: string): Promise<string | null> {
    try {
      return await this.redisService.client.get(key);
    } catch (error) {
      this.logger.error('redis-get-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Redis get failed');
    }
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      if (ttlSeconds > 0) {
        await this.redisService.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redisService.client.set(key, value);
      }
    } catch (error) {
      this.logger.error('redis-set-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Redis set failed');
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.redisService.client.del(key);
    } catch (error) {
      this.logger.error('redis-delete-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Redis delete failed');
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      return (await this.redisService.client.exists(key)) > 0;
    } catch (error) {
      this.logger.error('redis-exists-failed', { key, error: messageOf(error) });
      throw new ServiceUnavailableException('Redis exists failed');
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
