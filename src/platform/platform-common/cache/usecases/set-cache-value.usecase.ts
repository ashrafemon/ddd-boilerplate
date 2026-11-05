import { Injectable } from '@nestjs/common';
import { RedisCacheAdapter } from '../adapters/redis-cache.adapter';

/**
 * Use case: store a value with a bounded TTL (ms).
 *
 * A failed write is logged and never rolls back the caller's DB transaction.
 */
@Injectable()
export class SetCacheValueUseCase {
  constructor(private readonly cache: RedisCacheAdapter) {}

  execute<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    return this.cache.set<T>(key, value, ttlMs);
  }
}
