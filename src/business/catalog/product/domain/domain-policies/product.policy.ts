import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { ProductStatus } from '../types/product.enum';
import { ProductState } from '../types/product.types';

policyRegistry.register<ProductState>('product.reactivation', {
  name: 'discontinued-reactivation',
  evaluate: ({ status }) => {
    return status !== ProductStatus.DISCONTINUED;
  },
});
