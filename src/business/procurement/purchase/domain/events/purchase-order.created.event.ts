import { DomainEvent } from '@business/shared-business/domain/bases';
import { PurchaseOrderId } from '../value-objects';

export class PurchaseOrderCreated extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly orderNumber: string,
    public readonly vendorId: string,
  ) {
    super();
  }
}
