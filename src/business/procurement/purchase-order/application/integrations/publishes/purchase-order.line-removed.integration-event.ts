import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderLineRemovedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'purchase-order.line-removed',
    public occurredAt: string,
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
  ) {}
}
