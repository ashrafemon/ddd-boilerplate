import { Injectable } from '@nestjs/common';
import { CacheStorePort } from '../outbound/ports/cache-store.port';

/**
 * Use case: remove a cached key.
 *
 * Idempotent — deleting an absent key succeeds silently.
 */
@Injectable()
export class DeleteCacheValueUseCase {
  constructor(private readonly cache: CacheStorePort) {}

  execute(key: string): Promise<void> {
    return this.cache.delete(key);
  }
}
