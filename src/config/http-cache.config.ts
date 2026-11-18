import { registerAs } from '@nestjs/config';
import { booleanEnv, numericEnv } from '@common/application/utils/env.util';

/**
 * HTTP response cache config (NestJS `cache-manager`).
 *
 * This is the **request/response** cache: it stores what a controller returned
 * for a URL so the next identical GET can skip the handler. It is deliberately
 * separate from the platform cache module (`CachePort`), which is a data cache
 * for application code and never sees HTTP requests.
 *
 * Disabled by default: a route opts in with `@HttpCacheable()`, and even then
 * nothing is cached unless `HTTP_CACHE_ENABLED=true`.
 */
export interface IHttpCacheConfig {
  enabled: boolean;
  ttlMs: number;
}

export default registerAs('httpCache', () => ({
  enabled: booleanEnv('HTTP_CACHE_ENABLED', false),
  ttlMs: numericEnv('HTTP_CACHE_TTL_MS', 30_000),
}));
