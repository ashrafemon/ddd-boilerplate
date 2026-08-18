import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { ProductStatus } from '../types/product.enum';

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
