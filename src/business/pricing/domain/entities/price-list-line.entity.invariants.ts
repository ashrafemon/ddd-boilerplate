import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ price: number }>('price-list-line.create', {
  name: 'price-list-line-create-price',
  check: ({ price }) => {
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error('Price list line price cannot be negative'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ minQuantity: number; maxQuantity: number | null }>(
  'price-list-line.create-quantity-range',
  {
    name: 'price-list-line-create-quantity-range',
    check: ({ minQuantity, maxQuantity }) => {
      if (!Number.isFinite(minQuantity) || minQuantity < 1) {
        throw Object.assign(new Error('Price list line minimum quantity must be >= 1'), {
          statusCode: 422,
        });
      }
      if (maxQuantity !== null && maxQuantity < minQuantity) {
        throw Object.assign(
          new Error('Price list line maximum quantity must be >= minimum quantity'),
          { statusCode: 422 },
        );
      }
    },
  },
);
