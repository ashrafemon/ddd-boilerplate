import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { VendorState, VendorStatus } from '../types/vendor.types';

policyRegistry.register<VendorState>('vendor.orderability', {
  name: 'vendor-orderable',
  evaluate: ({ status }) => {
    if (status === VendorStatus.BLOCKED) return false;
    if (status === VendorStatus.INACTIVE) return false;
    return true;
  },
});
