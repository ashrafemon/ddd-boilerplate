import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ orderNumber: string }>('order-number.create', {
  name: 'order-number-required',
  check: ({ orderNumber }) => {
    if (!orderNumber.trim()) {
      throw Object.assign(new Error('Order number cannot be empty'), { statusCode: 422 });
    }
  },
});
