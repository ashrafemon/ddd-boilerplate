import { VendorFactory } from './vendor.factory';
import { VendorStatus } from '../types/vendor.enum';

describe('VendorFactory', () => {
  it('creates an active vendor with defaults', () => {
    const vendor = VendorFactory.create({
      code: 'VEN-100',
      name: 'Acme Supplies',
      email: 'billing@acme.com',
    });

    expect(vendor.code).toBe('VEN-100');
    expect(vendor.name).toBe('Acme Supplies');
    expect(vendor.email).toBe('billing@acme.com');
    expect(vendor.status).toBe(VendorStatus.ACTIVE);
    expect(vendor.isOrderable()).toBe(true);
  });

  it('creates a vendor without email', () => {
    const vendor = VendorFactory.create({ code: 'VEN-101', name: 'Globex' });
    expect(vendor.email).toBeNull();
    expect(vendor.status).toBe(VendorStatus.ACTIVE);
  });

  it('trims phone and address', () => {
    const vendor = VendorFactory.create({
      code: 'VEN-102',
      name: 'Initech',
      phone: '  555  ',
      address: '  1 Main St  ',
    });
    expect(vendor.phone).toBe('555');
    expect(vendor.address).toBe('1 Main St');
  });

  it('rejects a blank code', () => {
    expect(() => VendorFactory.create({ code: '', name: 'Acme' })).toThrow(
      'Vendor code is required',
    );
  });

  it('rejects a blank name', () => {
    expect(() => VendorFactory.create({ code: 'VEN-100', name: '' })).toThrow(
      'Vendor name is required',
    );
  });

  it('rejects an invalid code format', () => {
    expect(() => VendorFactory.create({ code: 'A', name: 'Acme' })).toThrow(
      'Vendor code must be 2-32 chars',
    );
  });

  it('rejects an invalid email', () => {
    expect(() => VendorFactory.create({ code: 'VEN-100', name: 'Acme', email: 'nope' })).toThrow(
      'Invalid vendor email',
    );
  });

  it('raises VendorCreated on creation', () => {
    const vendor = VendorFactory.create({ code: 'VEN-200', name: 'Initech' });
    expect(vendor.pullEvents()).toHaveLength(1);
  });
});
