import fc from 'fast-check';
import { buildLiveKey } from '../../repositories/prisma-saga-instance.repository';

/**
 * Property — the live-instance key must be injective.
 *
 * It is a database unique constraint, so a collision is not a failed test: it is
 * a saga that can never start. The generator includes the separator-adjacent
 * alphabet (`:`, `%`, `/`, `?`, `|`) and empty strings, because a naive join lets
 * `('a:b', 'c')` collide with `('a', 'b:c')`.
 */

const segment = fc.oneof(
  fc.string({ unit: fc.constantFrom('a', ':', '%', '2', 'F', '/', '?', '|', ' ', 'é', '\u0000') }),
  fc.constant(''),
);

describe('buildLiveKey properties', () => {
  it('is injective over hostile segment pairs', () => {
    fc.assert(
      fc.property(
        fc.tuple(segment, segment),
        fc.tuple(segment, segment),
        ([leftSaga, leftKey], [rightSaga, rightKey]) => {
          const same = buildLiveKey(leftSaga, leftKey) === buildLiveKey(rightSaga, rightKey);
          const identical = leftSaga === rightSaga && leftKey === rightKey;
          expect(same).toBe(identical);
        },
      ),
    );
  });

  it('never lets a percent-encoded segment forge the separator', () => {
    fc.assert(
      fc.property(segment, segment, (sagaKey, correlationKey) => {
        const key = buildLiveKey(sagaKey, correlationKey);
        expect(key.split('|')).toHaveLength(2);
      }),
    );
  });

  it('stays within the 500-char column bound for realistic keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (sagaKey, correlationKey) => {
          expect(buildLiveKey(sagaKey, correlationKey).length).toBeLessThanOrEqual(500);
        },
      ),
    );
  });
});
