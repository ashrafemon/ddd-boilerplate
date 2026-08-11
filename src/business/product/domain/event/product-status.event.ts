import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class ProductActivatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'product.activated';

  constructor(productId: string) {
    super({
      eventType: ProductActivatedEvent.EVENT_TYPE,
      aggregateType: 'Product',
      aggregateId: productId,
      payload: {},
    });
  }
}

export class ProductDeactivatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'product.deactivated';

  constructor(productId: string) {
    super({
      eventType: ProductDeactivatedEvent.EVENT_TYPE,
      aggregateType: 'Product',
      aggregateId: productId,
      payload: {},
    });
  }
}
