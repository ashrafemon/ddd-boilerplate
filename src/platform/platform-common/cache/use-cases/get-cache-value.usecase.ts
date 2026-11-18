import { Injectable } from '@nestjs/common';
import { CacheStorePort } from '../outbound/ports/cache-store.port';
import { CacheGetResult } from '../types/cache.types';

/**
 * Use case: retrieve a cached value by key.
 *
 * MISS on miss, disabled cache or backend error (fail-open).
 */
@Injectable()
export class GetCacheValueUseCase {
  constructor(private readonly cache: CacheStorePort) {}

  execute<T>(key: string): Promise<CacheGetResult<T>> {
    return this.cache.get<T>(key);
  }
}
