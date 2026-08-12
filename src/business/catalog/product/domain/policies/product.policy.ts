import { fail, ok } from '@business/shared-business/domain/result';
import { policyRegistry } from '@business/shared-business/domain/policies/policy.registry';
import { ProductStatus } from '../entities/product.aggregate';

export interface ProductState {
  status: ProductStatus;
}

/**
 * Product lifecycle policy — domain rules that evolve independently of
 * invariants. Registered in the shared policy registry and enforced through
 * it. Policies behave like invariants but may carry company-specific rules.
 */
policyRegistry.register<ProductState>('product.reactivation', {
  name: 'discontinued-reactivation',
  evaluate: ({ status }) => {
    if (status !== ProductStatus.DISCONTINUED) {
      return ok(true);
    }
    return fail('Discontinued products cannot be reactivated without policy approval');
  },
});
