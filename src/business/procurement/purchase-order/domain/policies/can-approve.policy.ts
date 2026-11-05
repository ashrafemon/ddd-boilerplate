import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderPolicyState, PurchaseOrderStatus } from '../types/purchase-order.types';

policyRegistry.register<PurchaseOrderPolicyState>('purchase-order.can-approve', {
  name: 'purchase-order-can-approve',
  evaluate: ({ status, totalAmount, autoApproveThreshold }) => {
    if (status !== PurchaseOrderStatus.SUBMITTED) return true;
    return totalAmount <= autoApproveThreshold;
  },
});
