import { CacheGetResult, CacheGetOrSetRequest } from '../cache.types';

/**
 * Cache abstraction (Redis / Memcached). Business/application code depends
 * only on this port and never on `ioredis` or a memcached client directly.
 *
 * Cache is disposable infrastructure — it is never the source of truth.
 * Business correctness remains in PostgreSQL / the authoritative repository.
 */
export abstract class CachePort {
  /** Retrieve a cached value by key. Returns null on miss or backend error (fail-open). */
  public abstract get<T>(key: string): Promise<T | null>;

  /** Retrieve a cached value with explicit HIT/MISS discrimination. */
  public abstract getWithResult<T>(key: string): Promise<CacheGetResult<T>>;

  /** Store a value with a bounded TTL (seconds). */
  public abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Remove a cached key. Idempotent — deleting an absent key succeeds silently. */
  public abstract delete(key: string): Promise<void>;

  /** Check whether a key exists and has not expired. */
  public abstract exists(key: string): Promise<boolean>;

  /**
   * Cache-aside convenience: return the cached value on HIT, or call the
   * factory, store the result, and return it on MISS.
   */
  public abstract getOrSet<T>(request: CacheGetOrSetRequest<T>): Promise<T>;
}
