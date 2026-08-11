import { Injectable } from '@nestjs/common';
import { InfrastructureException } from '@shared-kernel/exceptions/infrastructure.exception';
import { CachePort } from '@shared-kernel/ports/cache/cache.port';
import { RedisService } from './redis.service';

/**
 * Redis-backed cache adapter.
 */
@Injectable()
export class RedisCacheAdapter implements CachePort {
  constructor(private readonly redisService: RedisService) {}

  public async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redisService.client.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new InfrastructureException('Redis get failed', { key, cause: messageOf(error) });
    }
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.redisService.client.set(key, raw, 'EX', ttlSeconds);
      } else {
        await this.redisService.client.set(key, raw);
      }
    } catch (error) {
      throw new InfrastructureException('Redis set failed', { key, cause: messageOf(error) });
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.redisService.client.del(key);
    } catch (error) {
      throw new InfrastructureException('Redis delete failed', { key, cause: messageOf(error) });
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      return (await this.redisService.client.exists(key)) > 0;
    } catch (error) {
      throw new InfrastructureException('Redis exists failed', { key, cause: messageOf(error) });
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
