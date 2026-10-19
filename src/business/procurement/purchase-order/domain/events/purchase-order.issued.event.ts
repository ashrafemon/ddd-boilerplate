import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';

export class PurchaseOrderIssued extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}
