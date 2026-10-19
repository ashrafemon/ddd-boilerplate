import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { CacheGetResult } from '../cache.types';

/**
 * Redis cache adapter (design `common/01-cache`).
 *
 * Concrete class injected directly into the use cases — no internal storage
 * port. JSON serialize on write, `SET … PX ttlMs`.
 *
 * Fail-open: a Redis error on get is a MISS; a failed set/delete is logged and
 * never propagates (it must never roll back a DB transaction).
 */
@Injectable()
export class RedisCacheAdapter {
  private readonly logger = new Logger(RedisCacheAdapter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async get<T>(key: string): Promise<CacheGetResult<T>> {
    if (!this.configService.getCache().enabled) return { status: 'MISS' };
    const client = this.clientOrNull();
    if (!client) return { status: 'MISS' };
    try {
      const raw = await client.get(key);
      if (raw === null || raw === undefined) return { status: 'MISS' };
      return { status: 'HIT', value: JSON.parse(raw) as T };
    } catch (error) {
      this.logger.warn(`cache-get-failed: ${messageOf(error)}`);
      return { status: 'MISS' };
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const { enabled, defaultTtlMs, maxValueBytes } = this.configService.getCache();
    if (!enabled) return;
    const client = this.clientOrNull();
    if (!client) return;
    try {
      const raw = JSON.stringify(value);
      if (Buffer.byteLength(raw) > maxValueBytes) {
        this.logger.warn(`cache-set-skipped: value exceeds CACHE_MAX_VALUE_BYTES (${key})`);
        return;
      }
      const ttl = ttlMs ?? defaultTtlMs;
      if (ttl > 0) {
        await client.set(key, raw, 'PX', ttl);
      } else {
        await client.set(key, raw);
      }
    } catch (error) {
      this.logger.warn(`cache-set-failed: ${messageOf(error)}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.configService.getCache().enabled) return;
    const client = this.clientOrNull();
    if (!client) return;
    try {
      await client.del(key);
    } catch (error) {
      this.logger.warn(`cache-delete-failed: ${messageOf(error)}`);
    }
  }

  private clientOrNull() {
    try {
      return this.redisService?.client ?? null;
    } catch {
      return null;
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
