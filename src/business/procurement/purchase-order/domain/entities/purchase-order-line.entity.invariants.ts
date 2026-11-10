export class PurchaseOrderLineInvariants {
  static enforcePurchaseOrderLineQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Line quantity must be a positive integer'), {
        statusCode: 422,
      });
    }
  }
}
