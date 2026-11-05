import { Injectable } from '@nestjs/common';
import { RedisCacheAdapter } from '../adapters/redis-cache.adapter';
import { CacheGetResult } from '../cache.types';

/**
 * Use case: retrieve a cached value by key.
 *
 * MISS on miss, disabled cache or backend error (fail-open).
 */
@Injectable()
export class GetCacheValueUseCase {
  constructor(private readonly cache: RedisCacheAdapter) {}

  execute<T>(key: string): Promise<CacheGetResult<T>> {
    return this.cache.get<T>(key);
  }
}
