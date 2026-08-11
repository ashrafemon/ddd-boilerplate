import { Invariant } from '../../../../shared-business/invariant/invariant';
import { PurchaseOrderStatus } from '../value-object/purchase-order-status.vo';

export interface PurchaseOrderApprovalContext {
  current: PurchaseOrderStatus;
}

/**
 * A purchase order can only be approved once, and only from SUBMITTED.
 */
export class PurchaseOrderCannotBeApprovedTwiceInvariant extends Invariant {
  public readonly name = 'purchase-order-cannot-be-approved-twice';

  public check(context: PurchaseOrderApprovalContext): { isValid: boolean; messages: string[] } {
    if (context.current.getValue() !== 'SUBMITTED') {
      return {
        isValid: false,
        messages: [
          `Purchase order can only be approved from SUBMITTED, current status is ${context.current.getValue()}`,
        ],
      };
    }
    return { isValid: true, messages: [] };
  }
}
