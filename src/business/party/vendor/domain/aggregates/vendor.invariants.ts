import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { VendorStatus } from '../types/vendor.enum';

invariantRegistry.register<{ code: string; name: string; email?: string | null }>('vendor.create', {
  name: 'vendor-create-required-fields',
  check: ({ code, name, email }) => {
    if (!code?.trim()) {
      throw Object.assign(new Error('Vendor code is required'), { statusCode: 422 });
    }
    if (!name?.trim()) {
      throw Object.assign(new Error('Vendor name is required'), { statusCode: 422 });
    }
    if (email !== undefined && email !== null && !email.trim()) {
      throw Object.assign(new Error('Vendor email cannot be blank'), { statusCode: 422 });
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
