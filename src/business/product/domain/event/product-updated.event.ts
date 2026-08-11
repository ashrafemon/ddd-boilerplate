import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class ProductUpdatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'product.updated';

  constructor(productId: string) {
    super({
      eventType: ProductUpdatedEvent.EVENT_TYPE,
      aggregateType: 'Product',
      aggregateId: productId,
      payload: {},
    });
  }
}
