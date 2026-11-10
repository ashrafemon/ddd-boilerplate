import { PurchaseOrderStatus } from '../types/purchase-order.types';

export class CancellationPolicy {
  static enforcePurchaseOrderCancellation(status: PurchaseOrderStatus, hasReceipts: boolean): void {
    if (hasReceipts) {
      throw Object.assign(new Error('Cannot cancel a purchase order with posted receipts'), {
        statusCode: 422,
      });
    }
  }
}
