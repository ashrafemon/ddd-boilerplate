import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';

export class PurchaseOrderCreated extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly orderNumber: string,
    public readonly vendorId: string,
  ) {
    super();
  }
}

export class PurchaseOrderLineAdded extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
  ) {
    super();
  }
}

export class PurchaseOrderLineRemoved extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
  ) {
    super();
  }
}

export class PurchaseOrderSubmitted extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly orderNumber: string,
    public readonly vendorId: string,
  ) {
    super();
  }
}

export class PurchaseOrderApproved extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}

export class PurchaseOrderRejected extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly reason: string,
  ) {
    super();
  }
}

export class PurchaseOrderCancelled extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}

export class PurchaseOrderCompleted extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}
