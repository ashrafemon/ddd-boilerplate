import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderRejectedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'purchase-order.rejected',
    public occurredAt: string,
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly reason: string,
  ) {}
}
