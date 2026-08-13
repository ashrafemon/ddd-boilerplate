import { InvariantException } from '@business/shared-business/errors';
import { invariantRegistry } from '@business/shared-business/domain/invariants';
import { ProductStatus } from './product.aggregate';

/**
 * Product invariants — rules that MUST ALWAYS hold regardless of policy. Each
 * invariant is registered in the shared invariant registry and enforced by the
 * aggregate/factory through the registry, keeping the aggregate decoupled from
 * these rule modules.
 */
invariantRegistry.register<{ sku: string }>('product.create', {
  name: 'product-sku-required',
  check: ({ sku }) => {
    if (!sku.trim()) {
      throw new InvariantException('SKU cannot be empty');
    }
  },
});

invariantRegistry.register<{ name: string }>('product.create', {
  name: 'product-name-required',
  check: ({ name }) => {
    if (!name.trim()) {
      throw new InvariantException('Product name cannot be empty');
    }
  },
});

invariantRegistry.register<{ unitPrice: number }>('product.create', {
  name: 'product-price-non-negative',
  check: ({ unitPrice }) => {
    if (unitPrice < 0) {
      throw new InvariantException('Product price cannot be negative');
    }
  },
});

invariantRegistry.register<{ status: ProductStatus; to: ProductStatus }>(
  'product.status-transition',
  {
    name: 'product-valid-status-transition',
    check: ({ status, to }) => {
      if (status === to) return;

      const allowed: Record<ProductStatus, ProductStatus[]> = {
        [ProductStatus.ACTIVE]: [ProductStatus.INACTIVE, ProductStatus.DISCONTINUED],
        [ProductStatus.INACTIVE]: [ProductStatus.ACTIVE, ProductStatus.DISCONTINUED],
        [ProductStatus.DISCONTINUED]: [], // reactivation requires an explicit policy
      };

      if (!allowed[status].includes(to)) {
        throw new InvariantException(`Invalid product status transition: ${status} -> ${to}`);
      }
    },
  },
);
