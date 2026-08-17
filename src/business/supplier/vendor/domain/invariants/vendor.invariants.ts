import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { VendorStatus } from '../entities';

invariantRegistry.register<{ code: string }>('vendor.create', {
  name: 'vendor-code-format',
  check: ({ code }) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw Object.assign(new Error('Vendor code cannot be empty'), { statusCode: 422 });
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(normalized)) {
      throw Object.assign(
        new Error('Vendor code must be 2-32 chars of letters, digits or dashes'),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ name: string }>('vendor.create', {
  name: 'vendor-name-length',
  check: ({ name }) => {
    const normalized = name.trim();
    if (!normalized) {
      throw Object.assign(new Error('Vendor name cannot be empty'), { statusCode: 422 });
    }
    if (normalized.length > 200) {
      throw Object.assign(new Error('Vendor name cannot exceed 200 characters'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ email: string }>('vendor.create', {
  name: 'vendor-email-format',
  check: ({ email }) => {
    if (!email) return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw Object.assign(new Error('Invalid vendor email'), { statusCode: 422 });
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
