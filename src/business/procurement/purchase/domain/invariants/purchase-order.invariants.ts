import { InvariantException } from '@business/shared-business/errors';
import { invariantRegistry } from '@business/shared-business/domain/invariants';
import { PurchaseOrderStatus } from '../entities';

export type { PurchaseOrderStatus };

invariantRegistry.register<{ lineCount: number }>('purchase-order.has-lines', {
  name: 'purchase-order-has-lines',
  check: ({ lineCount }) => {
    if (lineCount < 1) {
      throw new InvariantException('Purchase order must contain at least one line');
    }
  },
});

invariantRegistry.register<{ quantity: number }>('purchase-order.line-quantity', {
  name: 'purchase-order-line-quantity-positive',
  check: ({ quantity }) => {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvariantException('Line quantity must be a positive integer');
    }
  },
});

invariantRegistry.register<{ status: PurchaseOrderStatus; to: PurchaseOrderStatus }>(
  'purchase-order.status-transition',
  {
    name: 'purchase-order-valid-transition',
    check: ({ status, to }) => {
      if (status === to) return;

      const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
        [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.CANCELLED],
        [PurchaseOrderStatus.SUBMITTED]: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.REJECTED,
          PurchaseOrderStatus.CANCELLED,
        ],
        [PurchaseOrderStatus.APPROVED]: [
          PurchaseOrderStatus.COMPLETED,
          PurchaseOrderStatus.CANCELLED,
        ],
        [PurchaseOrderStatus.REJECTED]: [],
        [PurchaseOrderStatus.CANCELLED]: [],
        [PurchaseOrderStatus.COMPLETED]: [],
      };

      if (!allowed[status].includes(to)) {
        throw new InvariantException(`Invalid purchase order transition: ${status} -> ${to}`);
      }
    },
  },
);

invariantRegistry.register<{ status: PurchaseOrderStatus }>('purchase-order.editable', {
  name: 'purchase-order-editable',
  check: ({ status }) => {
    if (status !== PurchaseOrderStatus.DRAFT) {
      throw new InvariantException(
        `Cannot modify a purchase order in status ${status}; only DRAFT orders are editable`,
      );
    }
  },
});
