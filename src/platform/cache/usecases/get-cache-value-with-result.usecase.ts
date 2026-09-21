import { Injectable, Logger } from '@nestjs/common';
import { CacheStoragePort } from '../ports/cache-storage.port';
import { CacheGetResult } from '../cache.types';

/**
 * Use case: retrieve a cached value with explicit HIT/MISS discrimination.
 *
 * Use this when the caller needs to distinguish "cached null" from "absent".
 */
@Injectable()
export class GetCacheValueWithResultUseCase {
  private readonly logger = new Logger(GetCacheValueWithResultUseCase.name);

  constructor(private readonly storage: CacheStoragePort) {}

  async execute<T>(key: string): Promise<CacheGetResult<T>> {
    try {
      const raw = await this.storage.get(key);
      if (raw == null) return { status: 'MISS' };
      const value = JSON.parse(raw) as T;
      return { status: 'HIT', value };
    } catch (error) {
      this.logger.warn('cache-get-result-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'MISS' };
    }
  }
}
