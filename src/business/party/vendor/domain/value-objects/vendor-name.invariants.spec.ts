import { VendorNameInvariants } from './vendor-name.invariants';

describe('VendorNameInvariants', () => {
  it('accepts a valid name', () => {
    expect(() => VendorNameInvariants.enforceVendorName('Acme Supplies')).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => VendorNameInvariants.enforceVendorName('   ')).toThrow(
      'Vendor name cannot be empty',
    );
  });

  it('rejects a name over 200 characters', () => {
    expect(() => VendorNameInvariants.enforceVendorName('A'.repeat(201))).toThrow(
      'Vendor name cannot exceed 200 characters',
    );
  });

  it('accepts a name of exactly 200 characters', () => {
    expect(() => VendorNameInvariants.enforceVendorName('A'.repeat(200))).not.toThrow();
  });
});
