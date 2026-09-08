import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderCreatedIntegrationEvent {
  constructor(
    public eventId: string,
    public eventType: 'purchase-order.created',
    public occurredAt: string,
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly orderNumber: string,
    public readonly vendorId: string,
    public readonly currency: string,
  ) {}
}
