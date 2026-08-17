import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderStatus } from '../entities';

export interface PurchaseOrderPolicyState {
  status: PurchaseOrderStatus;
  totalAmount: number;
  autoApproveThreshold: number;
}

policyRegistry.register<PurchaseOrderPolicyState>('purchase-order.approval', {
  name: 'purchase-order-approval-threshold',
  evaluate: ({ status, totalAmount, autoApproveThreshold }) => {
    if (status !== PurchaseOrderStatus.SUBMITTED) return false;
    return totalAmount > autoApproveThreshold;
  },
});
