import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderLineAddedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'purchase-order.line-added',
    public occurredAt: string,
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
  ) {}
}
