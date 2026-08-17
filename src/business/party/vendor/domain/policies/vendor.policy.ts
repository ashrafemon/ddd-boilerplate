import { fail, ok } from '@business/shared-business/domain/result';
import { policyRegistry } from '@business/shared-business/domain/policies';
import { VendorStatus } from '../entities';

export interface VendorState {
  status: VendorStatus;
}

/**
 * Purchasing policy — which vendors may receive new purchase orders. Enforced
 * through the policy registry.
 */
policyRegistry.register<VendorState>('vendor.orderability', {
  name: 'vendor-orderable',
  evaluate: ({ status }) => {
    if (status === VendorStatus.BLOCKED) {
      return fail('Blocked vendors cannot be used for new purchase orders');
    }
    if (status === VendorStatus.INACTIVE) {
      return fail('Inactive vendors cannot receive new purchase orders');
    }
    return ok(true);
  },
});
