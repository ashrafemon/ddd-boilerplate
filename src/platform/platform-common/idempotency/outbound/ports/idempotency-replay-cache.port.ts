import { IdempotencyCacheLookup, IdempotencyIdentity } from '../../types/idempotency.types';

/**
 * Outbound port: fast replay of COMPLETED results (Redis).
 *
 * Results only — never claims. A missing or unreachable cache degrades to a
 * Postgres replay, which is still correct; the cache only removes the query.
 */
export abstract class IdempotencyReplayCachePort {
  /** Build the replay key. Never hand-write it: tenancy is part of the identity. */
  abstract buildKey(identity: IdempotencyIdentity): string;

  abstract get(key: string): Promise<IdempotencyCacheLookup>;

  abstract set(key: string, value: unknown, ttlMs: number): Promise<void>;

  abstract delete(key: string): Promise<void>;
}
