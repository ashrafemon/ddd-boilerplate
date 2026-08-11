import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class ProductCreatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'product.created';

  constructor(productId: string, code: string) {
    super({
      eventType: ProductCreatedEvent.EVENT_TYPE,
      aggregateType: 'Product',
      aggregateId: productId,
      payload: { code },
    });
  }
}
