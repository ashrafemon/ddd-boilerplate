import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

export class PurchaseOrderApprovalService {
  static requiresManualApproval(
    status: PurchaseOrderStatus,
    totalAmount: number,
    autoApproveThreshold: number,
  ): boolean {
    return policyRegistry.evaluate('purchase-order.approval', {
      status,
      totalAmount,
      autoApproveThreshold,
    });
  }
}
