import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register<{ purchaseOrderId: string }>('grn.create', {
  name: 'grn-create-valid',
  check: ({ purchaseOrderId }) => {
    if (!purchaseOrderId) {
      throw Object.assign(new Error('Purchase order ID is required to create a GRN'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ lineCount: number }>('grn.has-lines', {
  name: 'grn-has-lines',
  check: ({ lineCount }) => {
    if (lineCount < 1) {
      throw Object.assign(new Error('GRN must have at least one line'), {
        statusCode: 422,
      });
    }
  },
});

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

invariantRegistry.register<{ reversalOfId: string }>('grn.reversal', {
  name: 'grn-reversal-links-original',
  check: ({ reversalOfId }) => {
    if (!reversalOfId) {
      throw Object.assign(new Error('A reversal document must reference its original GRN'), {
        statusCode: 422,
      });
    }
  },
});

/** GRN-05: a compensation mirrors the original as NEGATIVE quantities. */
invariantRegistry.register<{
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
}>('grn.reversal-balance', {
  name: 'grn-reversal-mirrors-original',
  check: ({ receivedQuantity, acceptedQuantity, rejectedQuantity }) => {
    if (acceptedQuantity + rejectedQuantity !== receivedQuantity) {
      throw Object.assign(new Error('Reversal accepted + rejected must equal received quantity'), {
        statusCode: 422,
      });
    }
    if (receivedQuantity >= 0) {
      throw Object.assign(
        new Error('Reversal quantities must be negative (compensating document)'),
        { statusCode: 422 },
      );
    }
    if (acceptedQuantity > 0 || rejectedQuantity > 0) {
      throw Object.assign(new Error('Reversal accepted/rejected cannot be positive'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ status: string }>('grn.editable', {
  name: 'grn-editable',
  check: ({ status }) => {
    if (status !== 'DRAFT') {
      throw Object.assign(new Error('GRN cannot be modified in its current status'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ status: string; to: string }>('grn.status-transition', {
  name: 'grn-valid-transition',
  check: ({ status, to }) => {
    if (status === to) return;

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['RECEIVED', 'CANCELLED'],
      RECEIVED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[status]?.includes(to)) {
      throw Object.assign(new Error('Invalid status transition for GRN'), {
        statusCode: 422,
      });
    }
  },
});
