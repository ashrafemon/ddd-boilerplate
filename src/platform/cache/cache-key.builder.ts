import { Injectable } from '@nestjs/common';
import { CacheKeyBuilderPort } from './ports/cache-key-builder.port';
import { CacheKey } from './cache.types';

/**
 * Deterministic cache key builder.
 *
 * Produces keys in the format:
 * ```
 * cache:{version}:{tenant}:{organization}:{namespace}:{resource}:{variant}
 * ```
 *
 * Example:
 * ```
 * cache:v1:tenant-001:company-001:client:123:summary
 * ```
 *
 * The key version can be bumped in `cache.config.ts` to invalidate an entire
 * namespace without scanning Redis.
 */
@Injectable()
export class CacheKeyBuilder implements CacheKeyBuilderPort {
  private readonly version: string;
  private readonly prefix: string;

  constructor() {
    // Configuration is read at module-definition time via process.env,
    // consistent with how resolveCacheDriver() works. The typed ConfigService
    // is not available at decorator/definition time.
    this.prefix = process.env.CACHE_KEY_PREFIX ?? 'cache';
    this.version = process.env.CACHE_KEY_VERSION ?? 'v1';
  }

  build(identity: CacheKey): string {
    return [
      this.prefix,
      this.version,
      identity.tenantId ?? 'platform',
      identity.organizationId ?? 'platform',
      identity.namespace,
      identity.resource,
      identity.variant ?? 'default',
    ].join(':');
  }
}
