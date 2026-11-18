import fc from 'fast-check';
import { buildLockKey, DistributedLockIdentity } from '../../types/locking.types';

/**
 * Property — lock key composition.
 *
 * The key is the only thing Redis keys the lock on, so the same identity must
 * always map to the same key and two different identities must never share one.
 * The generator uses the separator, the escape character and non-ASCII input.
 */

const segment = fc.string({ unit: fc.constantFrom('a', 'b', ':', '%', '/', ' ', 'é') });

const identity: fc.Arbitrary<DistributedLockIdentity> = fc.record({
  tenantId: segment,
  companyId: segment,
  scope: segment,
  resource: segment,
});

describe('buildLockKey properties', () => {
  it('is stable for one identity', () => {
    fc.assert(
      fc.property(identity, value => {
        expect(buildLockKey(value)).toBe(buildLockKey({ ...value }));
      }),
    );
  });

  it('is injective across all four fields', () => {
    fc.assert(
      fc.property(identity, identity, (left, right) => {
        const equal =
          left.tenantId === right.tenantId &&
          left.companyId === right.companyId &&
          left.scope === right.scope &&
          left.resource === right.resource;

        expect(buildLockKey(left) === buildLockKey(right)).toBe(equal);
      }),
    );
  });

  it('never lets a value shift across a field boundary', () => {
    fc.assert(
      fc.property(identity, value => {
        // Four fields after the `lock:` namespace.
        expect(buildLockKey(value).split(':')).toHaveLength(5);
      }),
    );
  });

  it('separates the tenant/company boundary that a raw join collapses', () => {
    const left = buildLockKey({
      tenantId: 'a:a',
      companyId: 'a',
      scope: 's',
      resource: 'r',
    });
    const right = buildLockKey({
      tenantId: 'a',
      companyId: 'a:a',
      scope: 's',
      resource: 'r',
    });

    expect(left).not.toBe(right);
  });
});
