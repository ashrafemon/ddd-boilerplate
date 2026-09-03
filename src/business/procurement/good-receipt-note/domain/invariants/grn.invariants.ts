import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';

invariantRegistry.register('grn.create', {
  validate: (input: { purchaseOrderId: string }) => !!input.purchaseOrderId,
  message: 'Purchase order ID is required to create a GRN',
});

invariantRegistry.register('grn.has-lines', {
  validate: (input: { lineCount: number }) => input.lineCount > 0,
  message: 'GRN must have at least one line',
});

invariantRegistry.register('grn.line-quantity', {
  validate: (input: { receivedQuantity: number }) => input.receivedQuantity > 0,
  message: 'Received quantity must be greater than zero',
});

invariantRegistry.register('grn.editable', {
  validate: (input: { status: string }) => ['DRAFT', 'RECEIVED'].includes(input.status),
  message: 'GRN cannot be modified in its current status',
});

invariantRegistry.register('grn.status-transition', {
  validate: (input: { status: string; to: string }) => {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['RECEIVED', 'CANCELLED'],
      RECEIVED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    return validTransitions[input.status]?.includes(input.to) ?? false;
  },
  message: 'Invalid status transition for GRN',
});