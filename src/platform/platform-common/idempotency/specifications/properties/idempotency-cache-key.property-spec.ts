import fc from 'fast-check';
import { ConfigService } from '@config/config.service';
import { RedisIdempotencyCacheAdapter } from '../../adapters/redis-idempotency-cache.adapter';
import { IdempotencyIdentity } from '../../types/idempotency.types';

/**
 * Property specification — the Redis replay key.
 *
 * Two properties matter and neither can be proven by examples:
 *  1. stability  — the same identity always maps to the same key, otherwise a
 *                  replay silently misses and the operation runs twice;
 *  2. injectivity — two different identities never map to the same key,
 *                  otherwise one tenant replays another tenant's response.
 *
 * Feature-flag/prefix/allowed characters are arbitrary strings, so the
 * generator uses full unicode including the separator itself.
 */

const adapter = new RedisIdempotencyCacheAdapter({
  getIdempotency: () => ({
    redisPrefix: 'idem',
    ttlMs: 1,
    claimLeaseMs: 1,
    reconciliationIntervalMs: 1,
  }),
} as unknown as ConfigService);

// A deliberately hostile alphabet: ':' is the separator, so a naive join is
// guaranteed to collide ('a:b' + 'c' vs 'a' + 'b:c').
const field = fc.string({
  unit: fc.constantFrom('a', 'b', ':', '%'),
  minLength: 1,
  maxLength: 4,
});
const identity = fc.record({
  tenantId: field,
  companyId: field,
  scope: field,
  key: field,
});

const sameIdentity = (a: IdempotencyIdentity, b: IdempotencyIdentity): boolean =>
  a.tenantId === b.tenantId &&
  a.companyId === b.companyId &&
  a.scope === b.scope &&
  a.key === b.key;

describe('idempotency cache key (property)', () => {
  it('is stable for an identical identity', () => {
    fc.assert(
      fc.property(identity, id => adapter.buildKey(id) === adapter.buildKey({ ...id })),
      { numRuns: 300 },
    );
  });

  it('is injective: distinct identities never share a key', () => {
    fc.assert(
      fc.property(identity, identity, (a, b) => {
        const keyA = adapter.buildKey(a);
        const keyB = adapter.buildKey(b);
        return sameIdentity(a, b) ? keyA === keyB : keyA !== keyB;
      }),
      { numRuns: 1_000 },
    );
  });

  it('does not let the separator shift across field boundaries', () => {
    // {tenant: 't:c', company: 's'} and {tenant: 't', company: 'c:s'} are
    // different identities. A join(':-style key collapses them into one.
    const pair = fc.tuple(field, field, field).map(([tenant, company, scope]) => [
      { tenantId: `${tenant}:${company}`, companyId: scope, scope: 's', key: 'k' },
      { tenantId: tenant, companyId: `${company}:${scope}`, scope: 's', key: 'k' },
    ]);

    fc.assert(
      fc.property(pair, ([a, b]) => {
        expect(sameIdentity(a, b)).toBe(false);
        return adapter.buildKey(a) !== adapter.buildKey(b);
      }),
      { numRuns: 200 },
    );
  });
});
