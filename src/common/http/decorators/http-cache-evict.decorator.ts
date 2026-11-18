import { SetMetadata } from '@nestjs/common';

export const HTTP_CACHE_EVICT_KEY = 'httpCacheEvict';

export interface HttpCacheEvictOptions {
  /**
   * Also evict the parent collection URL (`/purchase-orders/7` → `/purchase-orders`),
   * so a list read immediately after a write does not serve the old page.
   * Defaults to `true`; list URLs carrying query strings are bounded by the TTL
   * instead, because their keys cannot be enumerated.
   */
  collection?: boolean;
}

/**
 * Evicts the cached GET response for the route's URL after a successful
 * mutating handler (NestJS `cache-manager` request/response cache).
 *
 * Runs only on success: a failed mutation must not disturb a valid entry.
 * Fail-open: a failed eviction is swallowed — a route never fails because of
 * the cache.
 */
export const HttpCacheEvict = (options: HttpCacheEvictOptions = {}) =>
  SetMetadata(HTTP_CACHE_EVICT_KEY, options);
