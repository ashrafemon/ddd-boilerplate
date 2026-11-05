import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
  /**
   * Cache resource (aggregate type, e.g. `purchase-order`), used together with
   * the route `:id` to build a tenant-scoped key. Mutating routes that declare
   * the same resource + `:id` evict this entry via `@CacheEvict`.
   */
  resource?: string;
}

/**
 * Marks a GET route as cache read-through. On a HIT the cached `{ data, message }`
 * is returned without invoking the handler; on a MISS the handler runs and its
 * result is stored. Fail-open: a cache error is a MISS and a failed write is
 * swallowed — a route never fails because of the cache. Keys are tenant-scoped.
 *
 * Apply only to `GET :id` routes (list endpoints carry query params that must
 * be part of the key and stay on `CacheResponseInterceptor`).
 */
export const Cacheable = (options: CacheableOptions = {}) => SetMetadata(CACHEABLE_KEY, options);
