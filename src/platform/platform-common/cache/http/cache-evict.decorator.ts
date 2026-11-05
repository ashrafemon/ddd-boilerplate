import { SetMetadata } from '@nestjs/common';

export const CACHE_EVICT_KEY = 'cacheEvict';

export interface CacheEvictOptions {
  /**
   * Cache resource (aggregate type, e.g. `purchase-order`), evicted together
   * with the route `:id` after a successful mutating handler.
   */
  resource?: string;
}

/**
 * Marks a mutating route as cache write-through. After the handler succeeds,
 * the `{ resource, :id }` cache entry is evicted so the next read fetches
 * fresh data. Fail-open: a failed eviction is swallowed. Keys are tenant-scoped.
 */
export const CacheEvict = (options: CacheEvictOptions = {}) =>
  SetMetadata(CACHE_EVICT_KEY, options);
