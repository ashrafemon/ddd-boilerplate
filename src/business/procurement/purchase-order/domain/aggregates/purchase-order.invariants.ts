import { PurchaseOrderStatus } from '../types/purchase-order.enum';

export class PurchaseOrderInvariants {
  static enforcePurchaseOrderLineQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error('Line quantity must be a positive integer'), {
        statusCode: 422,
      });
    }
  }

  static enforcePurchaseOrderAmendable(status: PurchaseOrderStatus): void {
    if (status !== PurchaseOrderStatus.ISSUED) {
      throw Object.assign(
        new Error('Only an issued purchase order can be amended — amend before issuing'),
        { statusCode: 422 },
      );
    }
  }

  static enforcePurchaseOrderCreate(orderNumber: string, vendorId: string): void {
    if (!orderNumber?.trim()) {
      throw Object.assign(new Error('Purchase order number is required'), { statusCode: 422 });
    }
    if (!vendorId?.trim()) {
      throw Object.assign(new Error('Purchase order vendor is required'), { statusCode: 422 });
    }
  }

  static enforcePurchaseOrderHasLines(lineCount: number): void {
    if (lineCount < 1) {
      throw Object.assign(new Error('Purchase order must contain at least one line'), {
        statusCode: 422,
      });
    }
  }

  static enforcePurchaseOrderStatusTransition(
    status: PurchaseOrderStatus,
    to: PurchaseOrderStatus,
  ): void {
    if (status === to) return;

    const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
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
  }

  static enforcePurchaseOrderEditable(status: PurchaseOrderStatus): void {
    if (status !== PurchaseOrderStatus.DRAFT) {
      throw Object.assign(
        new Error(
          `Cannot modify a purchase order in status ${status}; only DRAFT orders are editable`,
        ),
        { statusCode: 422 },
      );
    }
  }

  static enforcePurchaseOrderCancellation(status: PurchaseOrderStatus, hasReceipts: boolean): void {
    if (hasReceipts) {
      throw Object.assign(new Error('Cannot cancel a purchase order with posted receipts'), {
        statusCode: 422,
      });
    }
  }

  static enforceRecurringPoLinesCreate(lines: unknown[]): void {
    if (!Array.isArray(lines) || lines.length < 1) {
      throw Object.assign(
        new Error('Recurring PurchaseOrder template must have at least one line'),
        { statusCode: 422 },
      );
    }
  }

  static enforceRecurringPoLineProductId(line: unknown, index: number): void {
    const record = line as Record<string, unknown>;
    const productId = record?.productId;
    if (typeof productId !== 'string' || !productId.trim()) {
      throw Object.assign(
        new Error(`Recurring PurchaseOrder lines[${index}].productId is required`),
        { statusCode: 422 },
      );
    }
  }

  static enforceRecurringPoLineQuantity(line: unknown, index: number): void {
    const record = line as Record<string, unknown>;
    const quantity = record?.quantity;
    const numeric = typeof quantity === 'number' ? quantity : Number(quantity);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring PurchaseOrder lines[${index}].quantity must be a number`),
        { statusCode: 422 },
      );
    }
  }

  static enforceRecurringPoLineUnitPrice(line: unknown, index: number): void {
    const record = line as Record<string, unknown>;
    const unitPrice = record?.unitPrice;
    const numeric = typeof unitPrice === 'number' ? unitPrice : Number(unitPrice);
    if (!Number.isFinite(numeric)) {
      throw Object.assign(
        new Error(`Recurring PurchaseOrder lines[${index}].unitPrice must be a number`),
        { statusCode: 422 },
      );
    }
  }
}
