import { Policy } from '@business/shared-business/domain/bases/policy.base';
import { Result, ok, fail } from '@business/shared-business/domain/result';
import { PurchaseOrderStatus } from '../entities/purchase-order.aggregate';

export interface PurchaseOrderState {
  status: PurchaseOrderStatus;
  totalAmount: number;
}

/**
 * Approval policy. A decision point that may evolve independently: currently
 * auto-approves orders under a threshold, routes larger ones for manual
 * approval.
 */
export class PurchaseOrderApprovalPolicy extends Policy<PurchaseOrderState> {
  private constructor(private readonly autoApproveThreshold: number) {
    super();
  }

  static default(): PurchaseOrderApprovalPolicy {
    return new PurchaseOrderApprovalPolicy(10_000);
  }

  evaluate(target: PurchaseOrderState): Result<{ requiresManualApproval: boolean }, string> {
    if (target.status !== PurchaseOrderStatus.SUBMITTED) {
      return fail('Only submitted purchase orders can be evaluated for approval');
    }
    return ok({ requiresManualApproval: target.totalAmount > this.autoApproveThreshold });
  }

  isSatisfiedBy(target: PurchaseOrderState): boolean {
    return this.evaluate(target).ok;
  }
}
