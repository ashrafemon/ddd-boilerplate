/**
 * Cache abstraction (Redis / Memcached). Business/application code depends
 * only on this port and never on `ioredis` or a memcached client directly.
 */
export abstract class CachePort {
  public abstract get<T>(key: string): Promise<T | null>;

  public abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  public abstract delete(key: string): Promise<void>;

  public abstract exists(key: string): Promise<boolean>;
}
