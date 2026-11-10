import { VendorStatus } from '../types/vendor.enum';

export class VendorInvariants {
  static enforceVendorCreate(code: string, name: string, email?: string | null): void {
    if (!code?.trim()) {
      throw Object.assign(new Error('Vendor code is required'), { statusCode: 422 });
    }
    if (!name?.trim()) {
      throw Object.assign(new Error('Vendor name is required'), { statusCode: 422 });
    }
    if (email !== undefined && email !== null && !email.trim()) {
      throw Object.assign(new Error('Vendor email cannot be blank'), { statusCode: 422 });
    }
  }

  static enforceVendorStatusTransition(status: VendorStatus, to: VendorStatus): void {
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
  }
}
