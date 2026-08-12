import { fail, ok } from '@business/shared-business/domain/result';
import { policyRegistry } from '@business/shared-business/domain/policies/policy.registry';
import { PurchaseOrderStatus } from '../entities/purchase-order.aggregate';

export interface PurchaseOrderPolicyState {
  status: PurchaseOrderStatus;
  totalAmount: number;
  autoApproveThreshold: number;
}

/**
 * Approval policy — a decision point that evolves independently of invariants:
 * auto-approves orders under the company's threshold, routes larger ones for
 * manual approval.
 */
policyRegistry.register<PurchaseOrderPolicyState>('purchase-order.approval', {
  name: 'purchase-order-approval-threshold',
  evaluate: ({ status, totalAmount, autoApproveThreshold }) => {
    if (status !== PurchaseOrderStatus.SUBMITTED) {
      return fail('Only submitted purchase orders can be evaluated for approval');
    }
    return ok(totalAmount > autoApproveThreshold);
  },
});
