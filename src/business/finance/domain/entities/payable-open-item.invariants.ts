export class PayableOpenItemInvariants {
  static enforcePayableOpenItemCreate(
    vendorId: string,
    vendorBillId: string,
    amount: number,
    dueDate: Date,
  ): void {
    if (!vendorId?.trim()) {
      throw Object.assign(new Error('Vendor ID is required'), { statusCode: 422 });
    }
    if (!vendorBillId?.trim()) {
      throw Object.assign(new Error('Vendor bill ID is required'), { statusCode: 422 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Payable open item amount must be positive'), {
        statusCode: 422,
      });
    }
    if (!dueDate || isNaN(dueDate.getTime())) {
      throw Object.assign(new Error('Due date is required'), { statusCode: 422 });
    }
  }
}
