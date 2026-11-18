import { CacheGetResult } from '../../types/cache.types';

/**
 * Outbound port: the key/value store behind the cache (Redis).
 *
 * Use cases depend on this port, never on the Redis adapter. It is deliberately
 * dumb — raw keys and values, no tenant logic and no key building (that belongs
 * to the inbound `CachePort` adapter).
 *
 * Read a miss as `MISS`, not as an error: the store is disposable and the
 * authoritative data always lives in PostgreSQL.
 */
export abstract class CacheStorePort {
  abstract get<T>(key: string): Promise<CacheGetResult<T>>;

  abstract set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

  abstract delete(key: string): Promise<void>;
}
