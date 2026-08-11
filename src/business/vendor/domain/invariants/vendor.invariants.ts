import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';
import { VendorStatus } from '../entities/vendor.aggregate';

/**
 * Rules that must ALWAYS hold for a Vendor, independent of policy.
 */
export const VendorInvariants = {
  assertValidStatusTransition(from: VendorStatus, to: VendorStatus): void {
    if (from === to) {
      return;
    }

    const allowed: Record<VendorStatus, VendorStatus[]> = {
      [VendorStatus.ACTIVE]: [VendorStatus.INACTIVE, VendorStatus.BLOCKED],
      [VendorStatus.INACTIVE]: [VendorStatus.ACTIVE, VendorStatus.BLOCKED],
      [VendorStatus.BLOCKED]: [VendorStatus.ACTIVE],
    };

    if (!allowed[from].includes(to)) {
      throw new InvariantException(`Invalid vendor status transition: ${from} -> ${to}`);
    }
  },
} as const;
