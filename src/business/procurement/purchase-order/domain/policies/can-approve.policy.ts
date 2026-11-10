import { PurchaseOrderStatus } from '../types/purchase-order.types';

export class CanApprovePolicy {
  static enforcePurchaseOrderCanApprove(
    status: PurchaseOrderStatus,
    totalAmount: number,
    autoApproveThreshold: number,
  ): boolean {
    if (status !== PurchaseOrderStatus.SUBMITTED) return true;
    return totalAmount <= autoApproveThreshold;
  }
}
