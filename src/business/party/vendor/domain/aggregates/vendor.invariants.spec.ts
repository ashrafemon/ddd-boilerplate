import { VendorInvariants } from './vendor.invariants';
import { VendorStatus } from '../types/vendor.enum';

describe('VendorInvariants', () => {
  describe('enforceVendorCreate', () => {
    it('throws when code is blank', () => {
      expect(() => VendorInvariants.enforceVendorCreate('', 'Acme')).toThrow(
        'Vendor code is required',
      );
    });

    it('throws when name is blank', () => {
      expect(() => VendorInvariants.enforceVendorCreate('VEN-1', '')).toThrow(
        'Vendor name is required',
      );
    });

    it('throws when email is a blank string', () => {
      expect(() => VendorInvariants.enforceVendorCreate('VEN-1', 'Acme', '   ')).toThrow(
        'Vendor email cannot be blank',
      );
    });

    it('passes with valid input', () => {
      expect(() =>
        VendorInvariants.enforceVendorCreate('VEN-1', 'Acme', 'billing@acme.com'),
      ).not.toThrow();
    });

    it('passes with undefined email', () => {
      expect(() => VendorInvariants.enforceVendorCreate('VEN-1', 'Acme', undefined)).not.toThrow();
    });

    it('passes with null email', () => {
      expect(() => VendorInvariants.enforceVendorCreate('VEN-1', 'Acme', null)).not.toThrow();
    });
  });

  describe('enforceVendorStatusTransition', () => {
    it.each([
      [VendorStatus.ACTIVE, VendorStatus.INACTIVE],
      [VendorStatus.ACTIVE, VendorStatus.BLOCKED],
      [VendorStatus.INACTIVE, VendorStatus.ACTIVE],
      [VendorStatus.INACTIVE, VendorStatus.BLOCKED],
      [VendorStatus.BLOCKED, VendorStatus.ACTIVE],
    ])('allows %s -> %s', (from, to) => {
      expect(() => VendorInvariants.enforceVendorStatusTransition(from, to)).not.toThrow();
    });

    it('allows a no-op transition', () => {
      expect(() =>
        VendorInvariants.enforceVendorStatusTransition(VendorStatus.ACTIVE, VendorStatus.ACTIVE),
      ).not.toThrow();
    });
  });
});
