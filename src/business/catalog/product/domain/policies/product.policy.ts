import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { ProductStatus } from '../entities';

export interface ProductState {
  status: ProductStatus;
}

policyRegistry.register<ProductState>('product.reactivation', {
  name: 'discontinued-reactivation',
  evaluate: ({ status }) => {
    return status !== ProductStatus.DISCONTINUED;
  },
});
