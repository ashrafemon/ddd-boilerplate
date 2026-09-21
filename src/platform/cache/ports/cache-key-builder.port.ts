import { CacheKey } from '../cache.types';

/**
 * Builds deterministic cache keys from a logical identity.
 *
 * Consumers should use this rather than manually concatenating Redis keys.
 * The key format is owned by the implementation and may change; consumers
 * should not parse or depend on the physical key shape.
 */
export abstract class CacheKeyBuilderPort {
  abstract build(identity: CacheKey): string;
}
