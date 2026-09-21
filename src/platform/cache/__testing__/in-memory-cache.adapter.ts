import { CacheStoragePort } from '../ports/cache-storage.port';

/**
 * In-memory cache adapter for unit tests.
 *
 * Preserves observable TTL semantics without requiring Redis or Memcached.
 * Suitable for testing use cases and the CacheService facade.
 */
export class InMemoryCacheAdapter implements CacheStoragePort {
  private readonly values = new Map<
    string,
    {
      value: string;
      expiresAt: number;
    }
  >();

  async get(key: string): Promise<string | null> {
    const entry = this.values.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.values.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return false;
    }
    return true;
  }

  /** Test helper: clear all entries. */
  clear(): void {
    this.values.clear();
  }

  /** Test helper: number of live entries. */
  get size(): number {
    let count = 0;
    const now = Date.now();
    for (const entry of this.values.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }
}
