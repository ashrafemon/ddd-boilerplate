import { DomainEvent } from '@business/shared-business/domain/bases';
import { PurchaseOrderId } from '../value-objects';

export class PurchaseOrderApproved extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}
