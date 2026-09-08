import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderApprovedIntegrationEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {}
}
