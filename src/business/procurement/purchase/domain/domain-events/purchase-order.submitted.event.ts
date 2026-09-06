import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';

export class PurchaseOrderSubmitted extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly orderNumber: string,
    public readonly vendorId: string,
  ) {
    super();
  }
}
