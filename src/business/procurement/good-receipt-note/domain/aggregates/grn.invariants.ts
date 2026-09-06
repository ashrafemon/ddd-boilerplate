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

invariantRegistry.register<{ status: string }>('grn.editable', {
  name: 'grn-editable',
  check: ({ status }) => {
    if (!['DRAFT', 'RECEIVED'].includes(status)) {
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
