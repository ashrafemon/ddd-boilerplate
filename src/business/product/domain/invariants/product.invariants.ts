import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';
import { ProductStatus } from '../entities/product.aggregate';

/**
 * Rules that must ALWAYS hold for a Product, regardless of policy. Each
 * invariant is independently testable.
 */
export const ProductInvariants = {
  assertValidStatusTransition(from: ProductStatus, to: ProductStatus): void {
    if (from === to) {
      return;
    }

    const allowed: Record<ProductStatus, ProductStatus[]> = {
      [ProductStatus.ACTIVE]: [ProductStatus.INACTIVE, ProductStatus.DISCONTINUED],
      [ProductStatus.INACTIVE]: [ProductStatus.ACTIVE, ProductStatus.DISCONTINUED],
      [ProductStatus.DISCONTINUED]: [], // reactivation requires an explicit policy
    };

    if (!allowed[from].includes(to)) {
      throw new InvariantException(`Invalid product status transition: ${from} -> ${to}`);
    }
  },
} as const;
