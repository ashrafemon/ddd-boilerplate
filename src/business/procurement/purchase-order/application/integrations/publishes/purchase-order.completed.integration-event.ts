import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderCompletedIntegrationEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {}
}
