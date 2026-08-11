import { Policy } from '@business/shared-business/domain/bases/policy.base';
import { Result, ok, fail } from '@business/shared-business/domain/result';
import { VendorStatus } from '../entities/vendor.aggregate';

export interface VendorState {
  status: VendorStatus;
}

/**
 * Purchasing policy: which vendors may receive new purchase orders. Evolves
 * independently of invariants.
 */
export class VendorOrderingPolicy extends Policy<VendorState> {
  evaluateOrderability(target: VendorState): Result<boolean, string> {
    if (target.status === VendorStatus.BLOCKED) {
      return fail('Blocked vendors cannot be used for new purchase orders');
    }
    if (target.status === VendorStatus.INACTIVE) {
      return fail('Inactive vendors cannot receive new purchase orders');
    }
    return ok(true);
  }

  isSatisfiedBy(target: VendorState): boolean {
    return this.evaluateOrderability(target).ok;
  }
}
