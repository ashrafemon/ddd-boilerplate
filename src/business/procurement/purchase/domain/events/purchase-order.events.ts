import { DomainEvent } from '@business/shared-business/domain/bases';
import { domainEventRegistry } from '@business/shared-business/domain/events';
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

domainEventRegistry.register('PurchaseOrderCreated', payload => {
  const p = payload as unknown as {
    purchaseOrderId: { value: string };
    orderNumber: string;
    vendorId: string;
  };
  return new PurchaseOrderCreated(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.orderNumber,
    p.vendorId,
  );
});

domainEventRegistry.register('PurchaseOrderLineAdded', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string }; productId: string };
  return new PurchaseOrderLineAdded(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.productId,
  );
});

domainEventRegistry.register('PurchaseOrderLineRemoved', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string }; productId: string };
  return new PurchaseOrderLineRemoved(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.productId,
  );
});

domainEventRegistry.register('PurchaseOrderSubmitted', payload => {
  const p = payload as unknown as {
    purchaseOrderId: { value: string };
    orderNumber: string;
    vendorId: string;
  };
  return new PurchaseOrderSubmitted(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.orderNumber,
    p.vendorId,
  );
});

domainEventRegistry.register('PurchaseOrderApproved', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string } };
  return new PurchaseOrderApproved(PurchaseOrderId.fromString(p.purchaseOrderId.value));
});

domainEventRegistry.register('PurchaseOrderRejected', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string }; reason: string };
  return new PurchaseOrderRejected(PurchaseOrderId.fromString(p.purchaseOrderId.value), p.reason);
});

domainEventRegistry.register('PurchaseOrderCancelled', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string } };
  return new PurchaseOrderCancelled(PurchaseOrderId.fromString(p.purchaseOrderId.value));
});

domainEventRegistry.register('PurchaseOrderCompleted', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string } };
  return new PurchaseOrderCompleted(PurchaseOrderId.fromString(p.purchaseOrderId.value));
});
