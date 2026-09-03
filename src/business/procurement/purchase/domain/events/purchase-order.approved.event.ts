import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';

export class PurchaseOrderApproved extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}
