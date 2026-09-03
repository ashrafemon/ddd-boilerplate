import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';

export class PurchaseOrderCreatedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly orderNumber: string,
    public readonly vendorId: string,
    public readonly currency: string,
  ) {
    super();
  }
}

export class PurchaseOrderLineAddedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
  ) {
    super();
  }
}

export class PurchaseOrderLineRemovedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly productId: string,
  ) {
    super();
  }
}

export class PurchaseOrderSubmittedIntegrationEvent extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}

export class PurchaseOrderApprovedIntegrationEvent extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}

export class PurchaseOrderRejectedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly purchaseOrderId: PurchaseOrderId,
    public readonly reason: string,
  ) {
    super();
  }
}

export class PurchaseOrderCancelledIntegrationEvent extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}

export class PurchaseOrderCompletedIntegrationEvent extends DomainEvent {
  constructor(public readonly purchaseOrderId: PurchaseOrderId) {
    super();
  }
}