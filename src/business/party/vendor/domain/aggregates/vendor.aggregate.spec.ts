import { VendorFactory } from '../factories/vendor.factory';
import { Vendor } from './vendor.aggregate';
import { VendorStatus } from '../types/vendor.enum';
import { VendorId } from '../value-objects/vendor-id.vo';
import { VendorCode, VendorEmail, VendorName } from '../value-objects/vendor.vos';

function makeVendor(overrides?: { status?: VendorStatus }): Vendor {
  const now = new Date();
  return Vendor.instantiate(
    VendorId.fromString('vendor-1'),
    {
      code: VendorCode.create('VEN-100'),
      name: VendorName.create('Acme'),
      email: VendorEmail.create('billing@acme.com'),
      phone: null,
      address: null,
      status: overrides?.status ?? VendorStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    },
    1,
  );
}

describe('Vendor aggregate', () => {
  describe('isOrderable', () => {
    it('returns true for ACTIVE', () => {
      expect(makeVendor({ status: VendorStatus.ACTIVE }).isOrderable()).toBe(true);
    });

    it('returns false for INACTIVE', () => {
      expect(makeVendor({ status: VendorStatus.INACTIVE }).isOrderable()).toBe(false);
    });

    it('returns false for BLOCKED', () => {
      expect(makeVendor({ status: VendorStatus.BLOCKED }).isOrderable()).toBe(false);
    });
  });

  describe('update', () => {
    it('updates the name', () => {
      const vendor = makeVendor();
      vendor.update({ name: 'New Name' });
      expect(vendor.name).toBe('New Name');
    });

    it('updates the email', () => {
      const vendor = makeVendor();
      vendor.update({ email: 'new@acme.com' });
      expect(vendor.email).toBe('new@acme.com');
    });

    it('clears the email when given an empty string', () => {
      const vendor = makeVendor();
      vendor.update({ email: '' });
      expect(vendor.email).toBeNull();
    });

    it('updates phone and address with trim', () => {
      const vendor = makeVendor();
      vendor.update({ phone: '  123  ', address: '  Main St  ' });
      expect(vendor.phone).toBe('123');
      expect(vendor.address).toBe('Main St');
    });

    it('clears phone/address when blank', () => {
      const vendor = makeVendor();
      vendor.update({ phone: '   ', address: '   ' });
      expect(vendor.phone).toBeNull();
      expect(vendor.address).toBeNull();
    });

    it('raises VendorUpdated event', () => {
      const vendor = makeVendor();
      const before = vendor.pullEvents().length;
      vendor.update({ name: 'X' });
      expect(vendor.pullEvents()).toHaveLength(before + 1);
    });
  });

  describe('status transitions', () => {
    it('activates an INACTIVE vendor', () => {
      const vendor = makeVendor({ status: VendorStatus.INACTIVE });
      vendor.activate();
      expect(vendor.status).toBe(VendorStatus.ACTIVE);
    });

    it('deactivates an ACTIVE vendor', () => {
      const vendor = makeVendor({ status: VendorStatus.ACTIVE });
      vendor.deactivate();
      expect(vendor.status).toBe(VendorStatus.INACTIVE);
    });

    it('blocks an ACTIVE vendor', () => {
      const vendor = makeVendor({ status: VendorStatus.ACTIVE });
      vendor.block();
      expect(vendor.status).toBe(VendorStatus.BLOCKED);
    });

    it('raises the matching event on each transition', () => {
      const vendor = makeVendor({ status: VendorStatus.INACTIVE });
      const events = vendor.pullEvents();
      vendor.activate();
      const afterActivate = vendor.pullEvents();
      expect(afterActivate).toHaveLength(1);
      expect(events).toHaveLength(0);
    });
  });

  describe('factory create', () => {
    it('produces an ACTIVE vendor', () => {
      const vendor = VendorFactory.create({ code: 'VEN-200', name: 'Globex' });
      expect(vendor.status).toBe(VendorStatus.ACTIVE);
    });
  });
});
