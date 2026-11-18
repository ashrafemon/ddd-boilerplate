import fc from 'fast-check';
import { hashInboxPayload } from '../../types/inbox.types';

/**
 * Property — inbox payload hashing.
 *
 * The hash decides whether a redelivery is "the same message". A generator that
 * only produces plain identifiers proves nothing, so the alphabet includes the
 * JSON specials (`"`, `\`, `:`, `,`, `{`, `}`), unicode and empty strings: those
 * are exactly the values that break a hand-rolled join-based canonicaliser.
 */

const hostile = fc.oneof(
  fc.string({ unit: fc.constantFrom('a', ':', ',', '"', '\\', '{', '}', '%', ' ', 'é', '\n') }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);

const value: fc.Arbitrary<unknown> = fc.letrec(tie => ({
  value: fc.oneof(
    { depthSize: 'large', maxDepth: 3 },
    hostile,
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(fc.string({ maxLength: 6 }), tie('value'), { maxKeys: 4 }),
  ),
})).value;

describe('hashInboxPayload properties', () => {
  it('always produces a 64-char hex digest', () => {
    fc.assert(
      fc.property(value, payload => {
        expect(hashInboxPayload(payload)).toMatch(/^[a-f0-9]{64}$/);
      }),
    );
  });

  it('is order-insensitive for object keys', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), value, { maxKeys: 5 }),
        record => {
          const reversed = Object.fromEntries(Object.entries(record).reverse());
          expect(hashInboxPayload(record)).toBe(hashInboxPayload(reversed));
        },
      ),
    );
  });

  it('never collides on a reordered array (order is content)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 2, maxLength: 5 }).filter(a => a[0] !== a[1]),
        array => {
          const swapped = [array[1], array[0], ...array.slice(2)];
          expect(hashInboxPayload(array)).not.toBe(hashInboxPayload(swapped));
        },
      ),
    );
  });

  it('distinguishes a string from a structurally similar object', () => {
    fc.assert(
      fc.property(fc.string(), text => {
        expect(hashInboxPayload({ text })).not.toBe(hashInboxPayload({ text: [text] }));
      }),
    );
  });
});
