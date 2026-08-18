import { VendorStatus } from '../types/vendor.types';
import { VendorBlocked, VendorCreated } from '../events';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { vendorFactory } from '../factories';

describe('Vendor aggregate', () => {
  const create = () =>
    vendorFactory.create({
      code: 'ven-001',
      name: 'Acme Supplies',
      email: 'billing@acme.com',
    });

  it('creates an active vendor with normalized code', () => {
    const vendor = create();

    expect(vendor.code).toBe('VEN-001');
    expect(vendor.status).toBe(VendorStatus.ACTIVE);
    expect(vendor.email).toBe('billing@acme.com');
    expect(vendor.pullEvents().some(e => e instanceof VendorCreated)).toBe(true);
  });

  it('validates email', () => {
    expect(() => vendorFactory.create({ code: 'V2', name: 'X', email: 'not-an-email' })).toThrow(
      'Invalid vendor email',
    );
  });

  it('blocks a vendor', () => {
    const vendor = create();
    vendor.pullEvents();

    vendor.block();
    expect(vendor.status).toBe(VendorStatus.BLOCKED);
    expect(vendor.pullEvents().some(e => e instanceof VendorBlocked)).toBe(true);
  });

  it('blocks then reactivates', () => {
    const vendor = create();
    vendor.pullEvents();

    vendor.block();
    vendor.activate();
    expect(vendor.status).toBe(VendorStatus.ACTIVE);
  });

  it('rejects invalid transitions', () => {
    const vendor = create();
    vendor.pullEvents();
    vendor.block();
    vendor.pullEvents();
    expect(() => vendor.deactivate()).toThrow();
  });

  it('evaluates orderability policy', () => {
    const active = create();
    expect(policyRegistry.evaluate('vendor.orderability', { status: active.status })).toBe(true);

    const blocked = create();
    blocked.block();
    expect(policyRegistry.evaluate('vendor.orderability', { status: blocked.status })).toBe(false);

    const inactive = create();
    inactive.deactivate();
    expect(policyRegistry.evaluate('vendor.orderability', { status: inactive.status })).toBe(false);
  });
});
