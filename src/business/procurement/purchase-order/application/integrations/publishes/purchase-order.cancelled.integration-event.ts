import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderCancelledIntegrationEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {}
}
