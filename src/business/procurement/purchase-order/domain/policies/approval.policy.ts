import { PurchaseOrderPolicyState, PurchaseOrderStatus } from '../types/purchase-order.types';

export class ApprovalPolicy {
  static enforcePurchaseOrderApproval(
    status: PurchaseOrderStatus,
    totalAmount: number,
    autoApproveThreshold: number,
  ): void {
    if (status !== PurchaseOrderStatus.SUBMITTED) return;
    if (totalAmount > autoApproveThreshold) {
      throw Object.assign(new Error('Purchase order requires approval'), { statusCode: 422 });
    }
  }
}
