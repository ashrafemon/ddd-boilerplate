import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class PurchaseOrderApprovedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'purchase.order.approved';

  constructor(purchaseOrderId: string, number: string) {
    super({
      eventType: PurchaseOrderApprovedEvent.EVENT_TYPE,
      aggregateType: 'PurchaseOrder',
      aggregateId: purchaseOrderId,
      payload: { number },
    });
  }
}
