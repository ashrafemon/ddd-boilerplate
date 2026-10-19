/**
 * Cache types — logical identity for deterministic cache keys.
 *
 * Consumers build keys through `CachePort.buildKey`; raw arbitrary strings
 * should not bypass the tenancy/key convention.
 */

/** Logical identity used to build a deterministic cache key. */
export interface CacheKey {
  tenantId?: string;
  organizationId?: string;
  namespace: string;
  resource: string;
  variant?: string;
}

/**
 * Discriminated result for `CachePort.get()`.
 *
 * MISS also covers a disabled cache, Redis errors and corrupt entries — the
 * caller always falls through to the authoritative source.
 */
export type CacheGetResult<T> =
  | {
      status: 'HIT';
      value: T;
    }
  | {
      status: 'MISS';
    };
