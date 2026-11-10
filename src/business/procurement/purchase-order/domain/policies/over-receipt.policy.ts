import { PurchaseOrderStatus } from '../types/purchase-order.types';

export class OverReceiptPolicy {
  static enforcePurchaseOrderOverReceipt(
    orderedQuantity: number,
    alreadyReceived: number,
    proposedQuantity: number,
    tolerance: number,
  ): void {
    const limit = orderedQuantity * (1 + tolerance);
    if (alreadyReceived + proposedQuantity > limit) {
      throw Object.assign(
        new Error(
          `Over-receipt: ${alreadyReceived + proposedQuantity} exceeds allowed ${limit} (ordered ${orderedQuantity} × (1 + ${tolerance}))`,
        ),
        { statusCode: 422 },
      );
    }
  }
}
