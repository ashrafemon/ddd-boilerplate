import { Injectable, Logger } from '@nestjs/common';
import { CacheStoragePort } from '../ports/cache-storage.port';
import { CacheGetOrSetRequest } from '../cache.types';

/**
 * Use case: cache-aside convenience — return the cached value on HIT,
 * or call the factory, store the result, and return it on MISS.
 *
 * The factory is invoked at most once per call. Callers should ensure the
 * factory is idempotent when concurrent requests may race on the same key.
 */
@Injectable()
export class GetOrSetCacheValueUseCase {
  private readonly logger = new Logger(GetOrSetCacheValueUseCase.name);

  constructor(private readonly storage: CacheStoragePort) {}

  async execute<T>(request: CacheGetOrSetRequest<T>): Promise<T> {
    try {
      const raw = await this.storage.get(request.key);
      if (raw != null) {
        return JSON.parse(raw) as T;
      }
    } catch (error) {
      this.logger.warn('cache-get-or-set-read-failed', {
        key: request.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const value = await request.factory();

    try {
      const serialized = JSON.stringify(value);
      await this.storage.set(request.key, serialized, request.ttlSeconds);
    } catch (error) {
      this.logger.warn('cache-get-or-set-write-failed', {
        key: request.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return value;
  }
}
