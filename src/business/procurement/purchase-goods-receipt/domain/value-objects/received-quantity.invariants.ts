import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ receivedQuantity: number }>('received-quantity.create', {
  name: 'received-quantity-positive',
  check: ({ receivedQuantity }) => {
    if (receivedQuantity <= 0) {
      throw Object.assign(new Error('Received quantity must be greater than zero'), {
        statusCode: 422,
      });
    }
  },
});
