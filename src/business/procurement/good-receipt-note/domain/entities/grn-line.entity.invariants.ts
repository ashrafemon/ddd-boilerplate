import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ receivedQuantity: number }>('grn.line-quantity', {
  name: 'grn-line-quantity-positive',
  check: ({ receivedQuantity }) => {
    if (receivedQuantity <= 0) {
      throw Object.assign(new Error('Received quantity must be greater than zero'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
}>('grn.inspection-balance', {
  name: 'grn-inspection-balance',
  check: ({ receivedQuantity, acceptedQuantity, rejectedQuantity }) => {
    if (acceptedQuantity + rejectedQuantity !== receivedQuantity) {
      throw Object.assign(new Error('Accepted + rejected must equal received quantity'), {
        statusCode: 422,
      });
    }
    if (acceptedQuantity < 0 || rejectedQuantity < 0) {
      throw Object.assign(new Error('Accepted/rejected quantities cannot be negative'), {
        statusCode: 422,
      });
    }
  },
});
