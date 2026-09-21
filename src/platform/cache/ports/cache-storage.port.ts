/**
 * Internal storage port — the low-level cache backend abstraction.
 *
 * This sits behind CachePort and is NOT injected by business modules.
 * It allows swapping Redis for another storage implementation without
 * changing consumers.
 */
export abstract class CacheStoragePort {
  abstract get(key: string): Promise<string | null>;

  abstract set(key: string, value: string, ttlSeconds: number): Promise<void>;

  abstract delete(key: string): Promise<void>;

  abstract exists(key: string): Promise<boolean>;
}
