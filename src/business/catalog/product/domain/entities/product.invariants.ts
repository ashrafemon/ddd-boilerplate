import { invariantRegistry } from '@business/shared-business/domain/invariants';
import { ProductStatus } from './product.aggregate';

invariantRegistry.register<{ sku: string }>('product.create', {
  name: 'product-sku-required',
  check: ({ sku }) => {
    if (!sku.trim()) {
      throw Object.assign(new Error('SKU cannot be empty'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ name: string }>('product.create', {
  name: 'product-name-required',
  check: ({ name }) => {
    if (!name.trim()) {
      throw Object.assign(new Error('Product name cannot be empty'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ unitPrice: number }>('product.create', {
  name: 'product-price-non-negative',
  check: ({ unitPrice }) => {
    if (unitPrice < 0) {
      throw Object.assign(new Error('Product price cannot be negative'), { statusCode: 422 });
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
        throw Object.assign(new Error(`Invalid product status transition: ${status} -> ${to}`), {
          statusCode: 422,
        });
      }
    },
  },
);
