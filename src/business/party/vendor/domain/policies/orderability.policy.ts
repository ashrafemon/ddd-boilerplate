import { VendorStatus } from '../types/vendor.types';

export class VendorOrderabilityPolicy {
  static enforceVendorOrderability(status: VendorStatus): boolean {
    if (status === VendorStatus.BLOCKED) return false;
    if (status === VendorStatus.INACTIVE) return false;
    return true;
  }
}
