import fc from 'fast-check';
import { CacheAdapter } from '../../adapters/cache.adapter';
import { CacheKey } from '../../types/cache.types';

/**
 * Property — cache key composition.
 *
 * The key is a single string carrying seven fields, so two rules must hold for
 * every possible input: the same identity always yields the same key, and two
 * different identities never yield the same key. The generator uses the
 * separator itself (`:`), the escape character (`%`) and the reserved default
 * labels as its alphabet — a naive `join(':')` breaks on exactly those.
 */

const CONFIG = {
  keyPrefix: 'cache',
  keyVersion: 'v1',
  enabled: true,
  defaultTtlMs: 1_000,
  maxValueBytes: 1_024,
};

const adapter = new CacheAdapter(
  {} as never,
  {} as never,
  {} as never,
  {
    getCache: () => CONFIG,
  } as never,
);

/** Hostile segment: separators, the escape character, and the default labels. */
const segment = fc.string({ unit: fc.constantFrom('a', 'b', ':', '%', '/', ' ', '0') });

const identity: fc.Arbitrary<CacheKey> = fc.record({
  tenantId: segment,
  companyId: segment,
  namespace: segment,
  resource: segment,
  variant: segment,
});

describe('CacheAdapter.buildKey properties', () => {
  it('is stable: the same identity always produces the same key', () => {
    fc.assert(
      fc.property(identity, value => {
        expect(adapter.buildKey(value)).toBe(adapter.buildKey({ ...value }));
      }),
    );
  });

  it('is injective: distinct identities never share a key', () => {
    fc.assert(
      fc.property(identity, identity, (left, right) => {
        const equal =
          left.tenantId === right.tenantId &&
          left.companyId === right.companyId &&
          left.namespace === right.namespace &&
          left.resource === right.resource &&
          left.variant === right.variant;

        const sameKey = adapter.buildKey(left) === adapter.buildKey(right);
        expect(sameKey).toBe(equal);
      }),
    );
  });

  it('never lets a value shift across a field boundary', () => {
    fc.assert(
      fc.property(identity, value => {
        // Seven fields in, seven segments out — whatever the values contain.
        expect(adapter.buildKey(value).split(':')).toHaveLength(7);
      }),
    );
  });

  it('distinguishes the tenant/company boundary that a raw join collapses', () => {
    // The regression that motivated escaping: `{tenant:'a:a', company:'a'}`
    // and `{tenant:'a', company:'a:a'}` used to produce one key.
    const left = adapter.buildKey({
      tenantId: 'a:a',
      companyId: 'a',
      namespace: 'n',
      resource: 'r',
    });
    const right = adapter.buildKey({
      tenantId: 'a',
      companyId: 'a:a',
      namespace: 'n',
      resource: 'r',
    });

    expect(left).not.toBe(right);
  });
});
