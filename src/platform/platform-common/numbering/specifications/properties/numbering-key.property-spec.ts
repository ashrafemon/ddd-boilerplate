import fc from 'fast-check';
import { buildSequenceKey } from '../../types/numbering.types';

/**
 * Property specification — sequence key namespacing.
 *
 * The hostile alphabet is deliberate: a generator that only produces tidy
 * alphanumerics would never expose a separator-injection collision.
 */
const HOSTILE_SEGMENT = fc.oneof(
  fc.string(),
  fc.constantFrom('', ':', '%', '/', '?', '"', '\\', '{', '}', '\n', 'a:b', 'é', '🔒'),
  fc.string({ minLength: 1, maxLength: 40 }),
);

describe('buildSequenceKey (property)', () => {
  it('is injective across (company, series) pairs', () => {
    fc.assert(
      fc.property(
        HOSTILE_SEGMENT,
        HOSTILE_SEGMENT,
        HOSTILE_SEGMENT,
        HOSTILE_SEGMENT,
        (companyA, keyA, companyB, keyB) => {
          const left = buildSequenceKey(companyA, keyA);
          const right = buildSequenceKey(companyB, keyB);
          if (left === right) {
            expect([companyA, keyA]).toEqual([companyB, keyB]);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('cannot be forged by moving a separator across the boundary', () => {
    fc.assert(
      fc.property(HOSTILE_SEGMENT, HOSTILE_SEGMENT, (company, key) => {
        const forged = buildSequenceKey(`${company}:${key}`, '');
        expect(forged).not.toBe(buildSequenceKey(company, key));
      }),
      { numRuns: 300 },
    );
  });

  it('keeps one separator and percent-encodes both segments', () => {
    fc.assert(
      fc.property(HOSTILE_SEGMENT, HOSTILE_SEGMENT, (company, key) => {
        const built = buildSequenceKey(company, key);
        expect(built).toBe(`${encodeURIComponent(company)}:${encodeURIComponent(key)}`);
        expect(built.split(':').length).toBe(2);
        expect(built).not.toContain('\n');
      }),
      { numRuns: 300 },
    );
  });
});
