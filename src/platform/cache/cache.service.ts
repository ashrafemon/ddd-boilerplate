import { Injectable, Logger } from '@nestjs/common';
import { CachePort } from './ports/cache.port';
import { CacheStoragePort } from './ports/cache-storage.port';
import { CacheGetResult, CacheGetOrSetRequest } from './cache.types';

/**
 * Cache service — the single entry point for all cache operations.
 *
 * Directly delegates to the CacheStoragePort adapter (Redis / Memcached)
 * without a use-case layer. The cache is a simple platform primitive,
 * not a business domain — no orchestration, no transaction boundaries,
 * no aggregate involvement.
 *
 * Failures are logged and wrapped — the caller falls back to the source
 * of truth. Cache write failures must never roll back database writes.
 */
@Injectable()
export class CacheService implements CachePort {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly storage: CacheStoragePort) {}

  /**
   * Retrieve a cached value by key.
   * Returns null on miss or backend error (fail-open).
   */
  async get<T>(key: string): Promise<T | null> {
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

  /**
   * Retrieve a cached value with explicit HIT/MISS discrimination.
   * Use this when the caller needs to distinguish "cached null" from "absent".
   */
  async getWithResult<T>(key: string): Promise<CacheGetResult<T>> {
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

  /**
   * Store a value with a bounded TTL (seconds).
   * Serialization/write failures are logged but do not propagate.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
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

  /**
   * Remove a cached key. Idempotent — deleting an absent key succeeds silently.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn('cache-delete-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check whether a key exists and has not expired.
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await this.storage.exists(key);
    } catch (error) {
      this.logger.warn('cache-exists-failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Cache-aside convenience: return the cached value on HIT, or call the
   * factory, store the result, and return it on MISS.
   *
   * The factory is invoked at most once per call. Callers should ensure the
   * factory is idempotent when concurrent requests may race on the same key.
   */
  async getOrSet<T>(request: CacheGetOrSetRequest<T>): Promise<T> {
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
