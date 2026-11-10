import { VendorBillStatus } from '../types/finance.enum';

export class VendorBillPolicy {
  static enforceVendorBillPostAllowed(status: VendorBillStatus, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Vendor bill amount must be positive to post'), {
        statusCode: 422,
      });
    }
    if (status !== VendorBillStatus.DRAFT) {
      throw Object.assign(new Error(`Cannot post vendor bill in status ${status}`), {
        statusCode: 422,
      });
    }
  }
}
