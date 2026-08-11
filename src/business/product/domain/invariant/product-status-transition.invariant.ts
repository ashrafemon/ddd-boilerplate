import { Invariant } from '../../../../shared-business/invariant/invariant';
import { ProductStatus, ProductStatusValue } from '../value-object/product-status.vo';

export interface ProductStatusTransitionContext {
  current: ProductStatus;
  target: ProductStatusValue;
}

const ALLOWED_TRANSITIONS: Record<ProductStatusValue, ProductStatusValue[]> = {
  [ProductStatusValue.ACTIVE]: [ProductStatusValue.INACTIVE],
  [ProductStatusValue.INACTIVE]: [ProductStatusValue.ACTIVE],
};

/**
 * A product may only move through legal status transitions.
 */
export class ProductStatusTransitionInvariant extends Invariant {
  public readonly name = 'product-status-transition-must-be-valid';

  public check(context: ProductStatusTransitionContext): { isValid: boolean; messages: string[] } {
    const allowed = ALLOWED_TRANSITIONS[context.current.getValue()] ?? [];
    if (!allowed.includes(context.target)) {
      return {
        isValid: false,
        messages: [
          `Cannot transition product status from ${context.current.getValue()} to ${context.target}`,
        ],
      };
    }
    return { isValid: true, messages: [] };
  }
}
