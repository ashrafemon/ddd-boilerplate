import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';

export interface OverReceiptCheck {
  orderedQuantity: number;
  alreadyReceived: number;
  proposedQuantity: number;
  tolerance: number;
}

policyRegistry.register<OverReceiptCheck>('purchase-order.over-receipt', {
  name: 'purchase-order-over-receipt',
  evaluate: ({ orderedQuantity, alreadyReceived, proposedQuantity, tolerance }) => {
    const limit = orderedQuantity * (1 + tolerance);
    if (alreadyReceived + proposedQuantity > limit) {
      throw Object.assign(
        new Error(
          `Over-receipt: ${alreadyReceived + proposedQuantity} exceeds allowed ${limit} (ordered ${orderedQuantity} × (1 + ${tolerance}))`,
        ),
        { statusCode: 422 },
      );
    }
    return true;
  },
});
