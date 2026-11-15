import { VendorOrderabilityPolicy } from './orderability.policy';
import { VendorStatus } from '../types/vendor.enum';

describe('VendorOrderabilityPolicy', () => {
  it('allows ACTIVE vendors', () => {
    expect(VendorOrderabilityPolicy.enforceVendorOrderability(VendorStatus.ACTIVE)).toBe(true);
  });

  it('blocks INACTIVE vendors', () => {
    expect(VendorOrderabilityPolicy.enforceVendorOrderability(VendorStatus.INACTIVE)).toBe(false);
  });

  it('blocks BLOCKED vendors', () => {
    expect(VendorOrderabilityPolicy.enforceVendorOrderability(VendorStatus.BLOCKED)).toBe(false);
  });
});
