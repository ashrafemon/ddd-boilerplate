import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class PurchaseOrderCreatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'purchase.order.created';

  constructor(purchaseOrderId: string, number: string) {
    super({
      eventType: PurchaseOrderCreatedEvent.EVENT_TYPE,
      aggregateType: 'PurchaseOrder',
      aggregateId: purchaseOrderId,
      payload: { number },
    });
  }
}

export class PurchaseOrderSubmittedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'purchase.order.submitted';

  constructor(purchaseOrderId: string, number: string) {
    super({
      eventType: PurchaseOrderSubmittedEvent.EVENT_TYPE,
      aggregateType: 'PurchaseOrder',
      aggregateId: purchaseOrderId,
      payload: { number },
    });
  }
}
