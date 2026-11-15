import { VendorEmailInvariants } from './vendor-email.invariants';

describe('VendorEmailInvariants', () => {
  it('accepts a valid email', () => {
    expect(() => VendorEmailInvariants.enforceVendorEmail('billing@acme.com')).not.toThrow();
  });

  it('accepts an empty string (treated as absent)', () => {
    expect(() => VendorEmailInvariants.enforceVendorEmail('')).not.toThrow();
  });

  it('rejects an email without a domain', () => {
    expect(() => VendorEmailInvariants.enforceVendorEmail('billing@acme')).toThrow(
      'Invalid vendor email',
    );
  });

  it('rejects an email without an @', () => {
    expect(() => VendorEmailInvariants.enforceVendorEmail('billing.acme.com')).toThrow(
      'Invalid vendor email',
    );
  });

  it('rejects an email with spaces', () => {
    expect(() => VendorEmailInvariants.enforceVendorEmail('a b@acme.com')).toThrow(
      'Invalid vendor email',
    );
  });
});
