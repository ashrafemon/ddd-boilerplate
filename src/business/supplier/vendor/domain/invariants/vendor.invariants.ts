import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';
import { invariantRegistry } from '@business/shared-business/domain/invariants/invariant.registry';
import { VendorStatus } from '../entities/vendor.aggregate';

invariantRegistry.register<{ code: string }>('vendor.create', {
  name: 'vendor-code-required',
  check: ({ code }) => {
    if (!code.trim()) {
      throw new InvariantException('Vendor code cannot be empty');
    }
  },
});

invariantRegistry.register<{ name: string }>('vendor.create', {
  name: 'vendor-name-required',
  check: ({ name }) => {
    if (!name.trim()) {
      throw new InvariantException('Vendor name cannot be empty');
    }
  },
});

invariantRegistry.register<{ status: VendorStatus; to: VendorStatus }>('vendor.status-transition', {
  name: 'vendor-valid-status-transition',
  check: ({ status, to }) => {
    if (status === to) return;

    const allowed: Record<VendorStatus, VendorStatus[]> = {
      [VendorStatus.ACTIVE]: [VendorStatus.INACTIVE, VendorStatus.BLOCKED],
      [VendorStatus.INACTIVE]: [VendorStatus.ACTIVE, VendorStatus.BLOCKED],
      [VendorStatus.BLOCKED]: [VendorStatus.ACTIVE],
    };

    if (!allowed[status].includes(to)) {
      throw new InvariantException(`Invalid vendor status transition: ${status} -> ${to}`);
    }
  },
});
