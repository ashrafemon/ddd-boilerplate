import { Injectable } from '@nestjs/common';
import { RedisCacheAdapter } from '../adapters/redis-cache.adapter';

/**
 * Use case: remove a cached key.
 *
 * Idempotent — deleting an absent key succeeds silently.
 */
@Injectable()
export class DeleteCacheValueUseCase {
  constructor(private readonly cache: RedisCacheAdapter) {}

  execute(key: string): Promise<void> {
    return this.cache.delete(key);
  }
}
