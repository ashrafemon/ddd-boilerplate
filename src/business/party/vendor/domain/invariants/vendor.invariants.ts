import { invariantRegistry } from '@business/shared-business/domain/invariants';
import { VendorStatus } from '../entities';

invariantRegistry.register<{ code: string }>('vendor.create', {
  name: 'vendor-code-required',
  check: ({ code }) => {
    if (!code.trim()) {
      throw Object.assign(new Error('Vendor code cannot be empty'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ name: string }>('vendor.create', {
  name: 'vendor-name-required',
  check: ({ name }) => {
    if (!name.trim()) {
      throw Object.assign(new Error('Vendor name cannot be empty'), { statusCode: 422 });
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
      throw Object.assign(new Error(`Invalid vendor status transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  },
});
