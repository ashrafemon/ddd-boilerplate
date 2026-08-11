import { Invariant } from '../../../../shared-business/invariant/invariant';
import { VendorStatus, VendorStatusValue } from '../value-object/vendor-status.vo';

export interface VendorStatusTransitionContext {
  current: VendorStatus;
  target: VendorStatusValue;
}

const ALLOWED_TRANSITIONS: Record<VendorStatusValue, VendorStatusValue[]> = {
  [VendorStatusValue.ACTIVE]: [VendorStatusValue.INACTIVE],
  [VendorStatusValue.INACTIVE]: [VendorStatusValue.ACTIVE],
};

/**
 * A vendor may only move through legal status transitions.
 */
export class VendorStatusTransitionInvariant extends Invariant {
  public readonly name = 'vendor-status-transition-must-be-valid';

  public check(context: VendorStatusTransitionContext): { isValid: boolean; messages: string[] } {
    const allowed = ALLOWED_TRANSITIONS[context.current.getValue()] ?? [];
    if (!allowed.includes(context.target)) {
      return {
        isValid: false,
        messages: [
          `Cannot transition vendor status from ${context.current.getValue()} to ${context.target}`,
        ],
      };
    }
    return { isValid: true, messages: [] };
  }
}
