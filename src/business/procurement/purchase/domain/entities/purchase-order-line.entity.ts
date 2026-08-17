import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductIdRef } from '../value-objects';

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
  ) {}

  withUpdatedQuantity(quantity: number, unitPrice: Money, total: Money): PurchaseOrderLine {
    return new PurchaseOrderLine(this.productId, quantity, unitPrice, total);
  }
}
