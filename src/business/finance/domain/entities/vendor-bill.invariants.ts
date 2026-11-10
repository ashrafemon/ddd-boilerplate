import { VendorBillStatus } from '../types/finance.enum';

export class VendorBillInvariants {
  static enforceVendorBillCreate(
    billNo: string,
    vendorId: string,
    amount: number,
    dueDate: Date,
  ): void {
    if (!billNo?.trim()) {
      throw Object.assign(new Error('Vendor bill number is required'), { statusCode: 422 });
    }
    if (!vendorId?.trim()) {
      throw Object.assign(new Error('Vendor ID is required'), { statusCode: 422 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Vendor bill amount must be positive'), { statusCode: 422 });
    }
    if (!dueDate || isNaN(dueDate.getTime())) {
      throw Object.assign(new Error('Due date is required'), { statusCode: 422 });
    }
  }

  static enforceVendorBillStatusTransition(status: VendorBillStatus, to: VendorBillStatus): void {
    if (status === to) return;

    const allowed: Record<VendorBillStatus, VendorBillStatus[]> = {
      [VendorBillStatus.DRAFT]: [VendorBillStatus.POSTED, VendorBillStatus.CANCELLED],
      [VendorBillStatus.POSTED]: [VendorBillStatus.PAID],
      [VendorBillStatus.PAID]: [],
      [VendorBillStatus.CANCELLED]: [],
    };

    if (!allowed[status].includes(to)) {
      throw Object.assign(new Error(`Invalid vendor bill transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  }
}
