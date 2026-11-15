import { VendorCode, VendorEmail, VendorName } from './vendor.vos';

describe('VendorName', () => {
  it('trims the input', () => {
    expect(VendorName.create('  Acme Supplies  ').value).toBe('Acme Supplies');
  });

  it('compares equal names', () => {
    expect(VendorName.create('Acme').equals(VendorName.create('Acme'))).toBe(true);
  });
});

describe('VendorCode', () => {
  it('trims and upper-cases the input', () => {
    expect(VendorCode.create('  ven-100  ').value).toBe('VEN-100');
  });

  it('compares equal codes', () => {
    expect(VendorCode.create('VEN-1').equals(VendorCode.create('ven-1'))).toBe(true);
  });
});

describe('VendorEmail', () => {
  it('trims and lower-cases the input', () => {
    expect(VendorEmail.create('  Billing@Acme.COM  ').value).toBe('billing@acme.com');
  });

  it('compares equal emails', () => {
    expect(VendorEmail.create('A@B.com').equals(VendorEmail.create('a@b.com'))).toBe(true);
  });
});
