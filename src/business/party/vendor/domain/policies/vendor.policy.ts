import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { VendorStatus } from '../entities';

export interface VendorState {
  status: VendorStatus;
}

policyRegistry.register<VendorState>('vendor.orderability', {
  name: 'vendor-orderable',
  evaluate: ({ status }) => {
    if (status === VendorStatus.BLOCKED) return false;
    if (status === VendorStatus.INACTIVE) return false;
    return true;
  },
});
