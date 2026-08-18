import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { VendorStatus } from '../types/vendor.enum';

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
