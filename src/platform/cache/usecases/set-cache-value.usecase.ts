import { Injectable, Logger } from '@nestjs/common';
import { CacheStoragePort } from '../ports/cache-storage.port';

/**
 * Use case: store a value with a bounded TTL (seconds).
 *
 * Serialization/write failures are logged but do not propagate.
 */
@Injectable()
export class SetCacheValueUseCase {
  private readonly logger = new Logger(SetCacheValueUseCase.name);

  constructor(private readonly storage: CacheStoragePort) {}

  async execute<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      await this.storage.set(key, raw, ttlSeconds ?? 300);
    } catch (error) {
      this.logger.warn('cache-set-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
