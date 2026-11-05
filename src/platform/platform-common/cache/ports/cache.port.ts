import { CacheGetResult, CacheKey } from '../cache.types';

/**
 * Cache abstraction (Redis). Business/application code depends only on this
 * port and never on `ioredis` directly.
 *
 * Cache is disposable infrastructure — it is never the source of truth.
 * Business correctness remains in PostgreSQL / the authoritative repository,
 * and the app stays correct with the cache disabled.
 */
export abstract class CachePort {
  /** Build every key through this — never hand-write a key. */
  abstract buildKey(identity: CacheKey): string;

  /** Read a key. MISS also covers Redis down and corrupt entries. */
  abstract get<T>(cacheKey: string): Promise<CacheGetResult<T>>;

  /** Store JSON for `ttlMs` (defaults to CACHE_DEFAULT_TTL_MS). */
  abstract set<T>(cacheKey: string, value: T, ttlMs?: number): Promise<void>;

  /** Remove one key. Missing key counts as success. */
  abstract delete(cacheKey: string): Promise<void>;
}
