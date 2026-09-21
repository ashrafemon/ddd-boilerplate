import { Injectable, Logger } from '@nestjs/common';
import { CacheStoragePort } from '../ports/cache-storage.port';

/**
 * Use case: retrieve a cached value by key.
 *
 * Returns null on miss or backend error (fail-open).
 */
@Injectable()
export class GetCacheValueUseCase {
  private readonly logger = new Logger(GetCacheValueUseCase.name);

  constructor(private readonly storage: CacheStoragePort) {}

  async execute<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.storage.get(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn('cache-get-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
