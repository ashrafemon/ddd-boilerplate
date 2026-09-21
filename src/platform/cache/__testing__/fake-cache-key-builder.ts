import { CacheKeyBuilderPort } from '../ports/cache-key-builder.port';
import { CacheKey } from '../cache.types';

/**
 * Fake cache key builder for unit tests.
 *
 * Produces deterministic, human-readable keys without the version prefix
 * so tests can assert on exact key shapes.
 */
export class FakeCacheKeyBuilder implements CacheKeyBuilderPort {
  build(identity: CacheKey): string {
    return [
      identity.tenantId ?? 'platform',
      identity.organizationId ?? 'platform',
      identity.namespace,
      identity.resource,
      identity.variant ?? 'default',
    ].join(':');
  }
}
