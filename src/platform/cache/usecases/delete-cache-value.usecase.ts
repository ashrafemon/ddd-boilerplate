import { Injectable, Logger } from '@nestjs/common';
import { CacheStoragePort } from '../ports/cache-storage.port';

/**
 * Use case: remove a cached key.
 *
 * Idempotent — deleting an absent key succeeds silently.
 */
@Injectable()
export class DeleteCacheValueUseCase {
  private readonly logger = new Logger(DeleteCacheValueUseCase.name);

  constructor(private readonly storage: CacheStoragePort) {}

  async execute(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn('cache-delete-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
