import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderSubmittedIntegrationEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {}
}
