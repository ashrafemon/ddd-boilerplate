import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

/** Wire shape for `PurchaseOrderClosed` (plan Phase 2.6 / §F). */
export class PurchaseOrderClosedIntegrationEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {}
}
