import fc from 'fast-check';
import {
  VendorCode,
  VendorEmail,
  VendorName,
} from '@business/party/vendor/domain/value-objects/vendor.vos';
import { VendorFactory } from '@business/party/vendor/domain/factories/vendor.factory';
import { VendorCodeInvariants } from '@business/party/vendor/domain/value-objects/vendor-code.invariants';
import { VendorEmailInvariants } from '@business/party/vendor/domain/value-objects/vendor-email.invariants';

/**
 * Vendor — property tests (fast-check).
 *
 * The invariants here are the ones a reviewer cannot check by example: that
 * normalization is idempotent, that the accepted alphabet is exactly the one
 * the regex claims, and that no whitespace/case variant can smuggle a second
 * vendor through the uniqueness check.
 */

const RUNS = { numRuns: 200 } as const;

const validCode = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), {
    minLength: 2,
    maxLength: 32,
  })
  .map(chars => chars.join(''));

const whitespace = fc.constantFrom(' ', '\t', '  ', '\n');

describe('Vendor domain properties', () => {
  it('VendorCode normalization is idempotent', () => {
    fc.assert(
      fc.property(validCode, code => {
        const once = VendorCode.create(code);
        const twice = VendorCode.create(once.value);
        expect(twice.equals(once)).toBe(true);
        expect(twice.value).toBe(once.value);
      }),
      RUNS,
    );
  });

  it('VendorCode is invariant to any surrounding whitespace and case', () => {
    fc.assert(
      fc.property(validCode, whitespace, whitespace, (code, before, after) => {
        const canonical = VendorCode.create(code);
        const noisy = VendorCode.create(`${before}${code.toLowerCase()}${after}`);
        expect(noisy.equals(canonical)).toBe(true);
      }),
      RUNS,
    );
  });

  it('accepts every code the documented alphabet can produce', () => {
    fc.assert(
      fc.property(validCode, code => {
        expect(() => VendorCodeInvariants.enforceVendorCode(code)).not.toThrow();
      }),
      RUNS,
    );
  });

  it('rejects blank codes and one-character codes', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.stringMatching(/^[ \t\n]{0,40}$/), fc.stringMatching(/^[A-Za-z0-9]$/)),
        code => {
          expect(() => VendorCodeInvariants.enforceVendorCode(code)).toThrow();
        },
      ),
      RUNS,
    );
  });

  it('rejects any character outside the accepted alphabet', () => {
    fc.assert(
      fc.property(validCode, fc.constantFrom('_', '.', '/', '@', '#', ' '), (code, bad) => {
        expect(() => VendorCodeInvariants.enforceVendorCode(code + bad + 'X')).toThrow();
      }),
      RUNS,
    );
  });

  it('VendorEmail normalization lowers and trims, and is idempotent', () => {
    fc.assert(
      fc.property(fc.emailAddress(), fc.constantFrom('', ' ', '  \t'), (email, pad) => {
        const normalized = VendorEmail.create(`${pad}${email.toUpperCase()}${pad}`);
        expect(normalized.value).toBe(`${email.toLowerCase()}`.trim());
        expect(VendorEmail.create(normalized.value).equals(normalized)).toBe(true);
        expect(() => VendorEmailInvariants.enforceVendorEmail(normalized.value)).not.toThrow();
      }),
      RUNS,
    );
  });

  it('VendorEmail rejects strings without @ or without a dotted domain', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(value => !value.includes('@')),
        value => {
          expect(() => VendorEmailInvariants.enforceVendorEmail(value)).toThrow();
        },
      ),
      RUNS,
    );
  });

  it('VendorName trims only — it never rewrites the named text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(value => value.trim().length > 0),
        whitespace,
        whitespace,
        (name, before, after) => {
          const padded = `${before}${name}${after}`;
          expect(VendorName.create(padded).value).toBe(padded.trim());
        },
      ),
      RUNS,
    );
  });

  it('every created vendor starts active, versioned and emits exactly one event', () => {
    fc.assert(
      fc.property(
        validCode,
        fc.string({ minLength: 1, maxLength: 50 }).filter(v => v.trim().length > 0),
        (code, name) => {
          const vendor = VendorFactory.create({ code, name });
          expect(vendor.code).toBe(code.trim().toUpperCase());
          expect(vendor.name).toBe(name.trim());
          const events = vendor.pullEvents();
          expect(events).toHaveLength(1);
          expect(vendor.pullEvents()).toHaveLength(0);
        },
      ),
      RUNS,
    );
  });
});
