import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { PurchaseOrderStatus } from '../types/purchase-order.enum';

export type { PurchaseOrderStatus };

invariantRegistry.register<{ status: string }>('purchase-order.amendable', {
  name: 'purchase-order-amendable',
  check: ({ status }) => {
    if (status !== 'ISSUED') {
      throw Object.assign(
        new Error('Only an issued purchase order can be amended — amend before issuing'),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ orderNumber: string; vendorId: string }>('purchase-order.create', {
  name: 'purchase-order-create-required-fields',
  check: ({ orderNumber, vendorId }) => {
    if (!orderNumber?.trim()) {
      throw Object.assign(new Error('Purchase order number is required'), { statusCode: 422 });
    }
    if (!vendorId?.trim()) {
      throw Object.assign(new Error('Purchase order vendor is required'), { statusCode: 422 });
    }
  },
});

invariantRegistry.register<{ lineCount: number }>('purchase-order.has-lines', {
  name: 'purchase-order-has-lines',
  check: ({ lineCount }) => {
    if (lineCount < 1) {
      throw Object.assign(new Error('Purchase order must contain at least one line'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ status: PurchaseOrderStatus; to: PurchaseOrderStatus }>(
  'purchase-order.status-transition',
  {
    name: 'purchase-order-valid-transition',
    check: ({ status, to }) => {
      if (status === to) return;

      const allowed: Record<string, string[]> = {
        [PurchaseOrderStatus.DRAFT]: [
          PurchaseOrderStatus.SUBMITTED,
          PurchaseOrderStatus.PENDINGAPPROVAL,
          PurchaseOrderStatus.CANCELLED,
        ],
        [PurchaseOrderStatus.SUBMITTED]: [
          PurchaseOrderStatus.PENDINGAPPROVAL,
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.REJECTED,
          PurchaseOrderStatus.CANCELLED,
        ],
        [PurchaseOrderStatus.PENDINGAPPROVAL]: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.REJECTED,
          PurchaseOrderStatus.DRAFT,
        ],
        [PurchaseOrderStatus.APPROVED]: [
          PurchaseOrderStatus.ISSUED,
          PurchaseOrderStatus.HOLD,
          PurchaseOrderStatus.REVISION,
          PurchaseOrderStatus.CANCELLED,
        ],
        [PurchaseOrderStatus.HOLD]: [PurchaseOrderStatus.APPROVED],
        [PurchaseOrderStatus.REVISION]: [PurchaseOrderStatus.APPROVED],
        // E-1: cancel is allowed from DRAFT/SUBMITTED/APPROVED only; an ISSUED
        // order is no longer freely cancelable — it closes (or is corrected
        // through the receipt-reversal workflow once goods arrived).
        [PurchaseOrderStatus.ISSUED]: [
          PurchaseOrderStatus.PARTIALLYRECEIVED,
          PurchaseOrderStatus.FULLYRECEIVED,
          PurchaseOrderStatus.COMPLETED,
          PurchaseOrderStatus.CLOSED,
        ],
        [PurchaseOrderStatus.PARTIALLYRECEIVED]: [
          PurchaseOrderStatus.PARTIALLYRECEIVED,
          PurchaseOrderStatus.FULLYRECEIVED,
          PurchaseOrderStatus.COMPLETED,
          PurchaseOrderStatus.CLOSED,
          PurchaseOrderStatus.CANCELLED,
        ],
        [PurchaseOrderStatus.FULLYRECEIVED]: [
          PurchaseOrderStatus.COMPLETED,
          PurchaseOrderStatus.CLOSED,
        ],
        [PurchaseOrderStatus.REJECTED]: [],
        [PurchaseOrderStatus.CANCELLED]: [],
        [PurchaseOrderStatus.COMPLETED]: [],
        [PurchaseOrderStatus.CLOSED]: [],
        [PurchaseOrderStatus.ARCHIVED]: [],
      };

      if (!(allowed[status] || []).includes(to)) {
        throw Object.assign(new Error(`Invalid purchase order transition: ${status} -> ${to}`), {
          statusCode: 422,
        });
      }
    },
  },
);

invariantRegistry.register<{ status: PurchaseOrderStatus }>('purchase-order.editable', {
  name: 'purchase-order-editable',
  check: ({ status }) => {
    if (status !== PurchaseOrderStatus.DRAFT) {
      throw Object.assign(
        new Error(
          `Cannot modify a purchase order in status ${status}; only DRAFT orders are editable`,
        ),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ lines: unknown[] }>('recurring-po-lines.create', {
  name: 'recurring-po-lines-required',
  check: ({ lines }) => {
    if (!Array.isArray(lines) || lines.length < 1) {
      throw Object.assign(
        new Error('Recurring PurchaseOrder template must have at least one line'),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ line: unknown; index: number }>('recurring-po-line.product-id', {
  name: 'recurring-po-line-product-id-required',
  check: ({ line, index }) => {
    const record = line as Record<string, unknown>;
    const productId = record?.productId;
    if (typeof productId !== 'string' || !productId.trim()) {
      throw Object.assign(
        new Error(`Recurring PurchaseOrder lines[${index}].productId is required`),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ line: unknown; index: number }>('recurring-po-line.quantity', {
  name: 'recurring-po-line-quantity-number',
  check: ({ line, index }) => {
    const record = line as Record<string, unknown>;
    const quantity = record?.quantity;
    const numeric = typeof quantity === 'number' ? quantity : Number(quantity);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring PurchaseOrder lines[${index}].quantity must be a number`),
        { statusCode: 422 },
      );
    }
  },
});

invariantRegistry.register<{ line: unknown; index: number }>('recurring-po-line.unit-price', {
  name: 'recurring-po-line-unit-price-number',
  check: ({ line, index }) => {
    const record = line as Record<string, unknown>;
    const unitPrice = record?.unitPrice;
    const numeric = typeof unitPrice === 'number' ? unitPrice : Number(unitPrice);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring PurchaseOrder lines[${index}].unitPrice must be a number`),
        { statusCode: 422 },
      );
    }
  },
});
