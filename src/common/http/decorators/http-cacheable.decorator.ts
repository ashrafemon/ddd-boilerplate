import { SetMetadata } from '@nestjs/common';

export const HTTP_CACHEABLE_KEY = 'httpCacheable';

export interface HttpCacheableOptions {
  /**
   * Entry TTL in milliseconds. Defaults to `HTTP_CACHE_TTL_MS`.
   */
  ttlMs?: number;
}

/**
 * Caches the value a **GET handler returned** for its URL (NestJS
 * `cache-manager`, the request/response cache — not `CachePort`, which caches
 * data for use cases).
 *
 * On a HIT the handler is skipped and the stored value is returned, so the
 * response envelope still renders normally. The key carries tenant, company and
 * the full URL (query string included), so two tenants never share an entry.
 *
 * Fail-open: a store error is a MISS and a failed write is swallowed — a route
 * never fails because of the cache. Nothing is cached while
 * `HTTP_CACHE_ENABLED=false`.
 *
 * Prefer `CachePort` (a module's own `ReadCachePort`) when the data, not the
 * response, is what deserves caching: an HTTP entry cannot be shared with a
 * background job or a use case.
 */
export const HttpCacheable = (options: HttpCacheableOptions = {}) =>
  SetMetadata(HTTP_CACHEABLE_KEY, options);
