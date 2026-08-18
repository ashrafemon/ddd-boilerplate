import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderPolicyState, PurchaseOrderStatus } from '../types/purchase-order.types';

policyRegistry.register<PurchaseOrderPolicyState>('purchase-order.approval', {
  name: 'purchase-order-approval-threshold',
  evaluate: ({ status, totalAmount, autoApproveThreshold }) => {
    if (status !== PurchaseOrderStatus.SUBMITTED) return false;
    return totalAmount > autoApproveThreshold;
  },
});
