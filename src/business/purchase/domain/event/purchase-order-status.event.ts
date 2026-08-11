import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class PurchaseOrderRejectedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'purchase.order.rejected';

  constructor(purchaseOrderId: string, reason: string) {
    super({
      eventType: PurchaseOrderRejectedEvent.EVENT_TYPE,
      aggregateType: 'PurchaseOrder',
      aggregateId: purchaseOrderId,
      payload: { reason },
    });
  }
}

export class PurchaseOrderCancelledEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'purchase.order.cancelled';

  constructor(purchaseOrderId: string, reason: string) {
    super({
      eventType: PurchaseOrderCancelledEvent.EVENT_TYPE,
      aggregateType: 'PurchaseOrder',
      aggregateId: purchaseOrderId,
      payload: { reason },
    });
  }
}

export class PurchaseOrderCompletedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'purchase.order.completed';

  constructor(purchaseOrderId: string, number: string) {
    super({
      eventType: PurchaseOrderCompletedEvent.EVENT_TYPE,
      aggregateType: 'PurchaseOrder',
      aggregateId: purchaseOrderId,
      payload: { number },
    });
  }
}
