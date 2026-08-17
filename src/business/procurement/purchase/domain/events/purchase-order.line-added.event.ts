import { DomainEvent } from '@business/shared-business/domain/bases';
import { PurchaseOrderId } from '../value-objects';

export class PurchaseOrderLineAdded extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
  ) {
    super();
  }
}
