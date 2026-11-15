import { VendorCodeInvariants } from './vendor-code.invariants';

describe('VendorCodeInvariants', () => {
  it('accepts a valid code', () => {
    expect(() => VendorCodeInvariants.enforceVendorCode('VEN-100')).not.toThrow();
  });

  it('accepts a lower-case code (normalized)', () => {
    expect(() => VendorCodeInvariants.enforceVendorCode('ven-100')).not.toThrow();
  });

  it('rejects an empty code', () => {
    expect(() => VendorCodeInvariants.enforceVendorCode('   ')).toThrow(
      'Vendor code cannot be empty',
    );
  });

  it('rejects a too-short code', () => {
    expect(() => VendorCodeInvariants.enforceVendorCode('A')).toThrow(
      'Vendor code must be 2-32 chars',
    );
  });

  it('rejects a too-long code', () => {
    expect(() => VendorCodeInvariants.enforceVendorCode('A'.repeat(33))).toThrow(
      'Vendor code must be 2-32 chars',
    );
  });

  it('rejects illegal characters', () => {
    expect(() => VendorCodeInvariants.enforceVendorCode('VEN 100')).toThrow(
      'Vendor code must be 2-32 chars',
    );
    expect(() => VendorCodeInvariants.enforceVendorCode('VEN_100')).toThrow(
      'Vendor code must be 2-32 chars',
    );
  });
});
