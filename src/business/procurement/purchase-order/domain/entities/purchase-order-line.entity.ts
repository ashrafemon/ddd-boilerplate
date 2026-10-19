import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductIdRef } from '../value-objects/purchase-order.vos';

/**
 * Purchase order line — a child entity owned by the PurchaseOrder aggregate.
 * Entity classes stay separate from aggregates/value objects and never import
 * aggregate internals.
 */
export class PurchaseOrderLine {
  constructor(
    public readonly productId: ProductIdRef,
    public readonly quantity: number,
    public readonly unitPrice: Money,
    public readonly total: Money,
    public receivedQuantity: number = 0,
    // Commercial snapshot from the product master at add time (spec §3.2/§3.3):
    // immutable once written — a product rename never rewrites an existing PO.
    public readonly descriptionSnapshot: string | null = null,
  ) {}

  withUpdatedQuantity(quantity: number, unitPrice: Money, total: Money): PurchaseOrderLine {
    return new PurchaseOrderLine(
      this.productId,
      quantity,
      unitPrice,
      total,
      this.receivedQuantity,
      this.descriptionSnapshot,
    );
  }

  /**
   * Amended unit price (spec §4 AmendPurchaseOrder). Only legal on a line
   * that has NOT been received yet — a price that was already invoiced or
   * received against must not move. The line total is recomputed.
   */
  withAmendedUnitPrice(unitPrice: Money, total: Money): PurchaseOrderLine {
    return new PurchaseOrderLine(
      this.productId,
      this.quantity,
      unitPrice,
      total,
      this.receivedQuantity,
      this.descriptionSnapshot,
    );
  }

  withReceivedQuantity(receivedQuantity: number): PurchaseOrderLine {
    return new PurchaseOrderLine(
      this.productId,
      this.quantity,
      this.unitPrice,
      this.total,
      receivedQuantity,
      this.descriptionSnapshot,
    );
  }

  /**
   * Apply a receipt delta (positive = receive, negative = reversal compensation).
   * Kept as a mutating entity method so the factory can mutate lines in place
   * without rebuilding the whole line list.
   */
  receive(delta: number): void {
    if (!Number.isInteger(delta)) {
      throw Object.assign(new Error('Received quantity delta must be an integer'), {
        statusCode: 422,
      });
    }
    this.receivedQuantity = this.receivedQuantity + delta;
  }
}
