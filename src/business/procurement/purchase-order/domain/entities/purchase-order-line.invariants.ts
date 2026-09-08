import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ quantity: number }>('purchase-order-line.quantity-positive', {
  name: 'purchase-order-line-quantity-positive',
  check: ({ quantity }) => {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Line quantity must be a positive integer'), {
        statusCode: 422,
      });
    }
  },
});
