import { Policy } from '@business/shared-business/domain/bases/policy.base';
import { Result, ok, fail } from '@business/shared-business/domain/result';
import { ProductStatus } from '../entities/product.aggregate';

export interface ProductState {
  status: ProductStatus;
}

/**
 * Product lifecycle policy. Domain rules that may evolve independently of
 * invariants — here: reactivating a discontinued product requires an explicit
 * approval decision.
 */
export class ProductPolicy extends Policy<ProductState> {
  private constructor(private readonly allowDiscontinuedReactivation = false) {
    super();
  }

  static withDiscontinuedReactivationEnabled(): ProductPolicy {
    return new ProductPolicy(true);
  }

  static default(): ProductPolicy {
    return new ProductPolicy(false);
  }

  evaluateReactivation(target: ProductState): Result<boolean, string> {
    if (target.status !== ProductStatus.DISCONTINUED) {
      return ok(true);
    }
    if (this.allowDiscontinuedReactivation) {
      return ok(true);
    }
    return fail('Discontinued products cannot be reactivated without policy approval');
  }

  isSatisfiedBy(target: ProductState): boolean {
    return this.evaluateReactivation(target).ok;
  }
}
