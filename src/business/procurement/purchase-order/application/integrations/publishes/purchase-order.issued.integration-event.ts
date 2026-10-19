import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

/** Wire shape for `PurchaseOrderIssued` (plan Phase 2.6 / §F). */
export class PurchaseOrderIssuedIntegrationEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {}
}
