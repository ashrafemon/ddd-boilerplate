/**
 * Cache types — logical identity for deterministic cache keys.
 *
 * Consumers build keys through `CacheKeyBuilderPort`; raw arbitrary strings
 * should not bypass the tenancy/key convention unless the use case explicitly
 * owns a platform-level key.
 */
export interface CacheKey {
  tenantId?: string;
  organizationId?: string;
  namespace: string;
  resource: string;
  variant?: string;
}

/** Options for cache set operations. */
export interface CacheSetOptions {
  /** Time-to-live in seconds. */
  ttlSeconds: number;
}

/** Request shape for CachePort.get(). */
export interface CacheGetRequest {
  key: string;
}

/** Request shape for CachePort.set(). */
export interface CacheSetRequest<T> {
  key: string;
  value: T;
  ttlSeconds: number;
}

/** Request shape for CachePort.delete(). */
export interface CacheDeleteRequest {
  key: string;
}

/** Request shape for CachePort.getOrSet(). */
export interface CacheGetOrSetRequest<T> {
  key: string;
  ttlSeconds: number;
  factory: () => Promise<T>;
}

/**
 * Discriminated result for CachePort.get().
 *
 * Using an explicit result type avoids ambiguity between:
 * - cache MISS
 * - cached null/undefined
 */
export type CacheGetResult<T> =
  | {
      status: 'HIT';
      value: T;
    }
  | {
      status: 'MISS';
    };
