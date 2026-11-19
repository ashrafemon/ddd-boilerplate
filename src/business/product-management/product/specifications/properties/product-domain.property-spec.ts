import fc from 'fast-check';
import { Sku } from '@business/product-management/product/domain/value-objects/sku.vo';
import { SkuInvariants } from '@business/product-management/product/domain/value-objects/sku.invariants';
import { ProductNameInvariants } from '@business/product-management/product/domain/value-objects/product-name.invariants';

/**
 * Product — property tests (fast-check).
 *
 * SKU and name validation are the two rules every import/API path funnels
 * through, so they are checked over the whole accepted input space rather than
 * on a handful of examples.
 */

const RUNS = { numRuns: 200 } as const;

const validSku = fc
  .array(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
    {
      minLength: 2,
      maxLength: 64,
    },
  )
  .map(chars => chars.join(''));

const whitespace = fc.constantFrom(' ', '\t', '  ');

describe('Product domain properties', () => {
  it('Sku.create uppercases and trims, and is idempotent', () => {
    fc.assert(
      fc.property(validSku, whitespace, whitespace, (sku, before, after) => {
        const created = Sku.create(`${before}${sku}${after}`);
        expect(created.value).toBe(sku.trim().toUpperCase());
        expect(Sku.create(created.value).value).toBe(created.value);
      }),
      RUNS,
    );
  });

  it('accepts every SKU the documented alphabet can produce', () => {
    fc.assert(
      fc.property(validSku, sku => {
        expect(() => SkuInvariants.enforceSkuFormat(sku)).not.toThrow();
      }),
      RUNS,
    );
  });

  it('rejects SKUs shorter than 2 or longer than 64 characters', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          validSku.map(sku => sku.slice(0, 1)),
          validSku.map(sku => sku + 'A'.repeat(64)),
        ),
        sku => {
          expect(() => SkuInvariants.enforceSkuFormat(sku)).toThrow();
        },
      ),
      RUNS,
    );
  });

  it('rejects characters outside the alphabet', () => {
    fc.assert(
      fc.property(validSku, fc.constantFrom('_', '.', '/', '@', '!'), (sku, bad) => {
        expect(() => SkuInvariants.enforceSkuFormat(`${sku}${bad}`)).toThrow();
      }),
      RUNS,
    );
  });

  it('rejects blank SKUs', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t\n]{0,20}$/), blank => {
        expect(() => SkuInvariants.enforceSkuFormat(blank)).toThrow();
      }),
      RUNS,
    );
  });

  it('accepts product names of 1..200 trimmed characters and rejects longer ones', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(name => name.trim().length > 0),
        name => {
          expect(() => ProductNameInvariants.enforceProductName(name)).not.toThrow();
        },
      ),
      RUNS,
    );

    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z]{201,260}$/), name => {
        expect(() => ProductNameInvariants.enforceProductName(name)).toThrow();
      }),
      RUNS,
    );
  });

  it('rejects blank product names', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[ \t\n]{0,20}$/), blank => {
        expect(() => ProductNameInvariants.enforceProductName(blank)).toThrow();
      }),
      RUNS,
    );
  });
});
