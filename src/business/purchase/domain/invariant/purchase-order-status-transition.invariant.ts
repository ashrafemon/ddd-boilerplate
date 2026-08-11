import { Invariant } from '../../../../shared-business/invariant/invariant';
import {
  PurchaseOrderStatus,
  PurchaseOrderStatusValue,
} from '../value-object/purchase-order-status.vo';

export interface PurchaseOrderStatusTransitionContext {
  current: PurchaseOrderStatus;
  target: PurchaseOrderStatusValue;
}

/**
 * Enforces the legal status graph of a purchase order.
 */
export class PurchaseOrderStatusTransitionInvariant extends Invariant {
  public readonly name = 'purchase-order-status-transition-must-be-valid';

  public check(context: PurchaseOrderStatusTransitionContext): { isValid: boolean; messages: string[] } {
    if (!context.current.canTransitionTo(context.target)) {
      return {
        isValid: false,
        messages: [
          `Cannot transition purchase order from ${context.current.getValue()} to ${context.target}`,
        ],
      };
    }
    return { isValid: true, messages: [] };
  }
}
