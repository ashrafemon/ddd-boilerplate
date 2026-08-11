import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class VendorActivatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'vendor.activated';

  constructor(vendorId: string) {
    super({
      eventType: VendorActivatedEvent.EVENT_TYPE,
      aggregateType: 'Vendor',
      aggregateId: vendorId,
      payload: {},
    });
  }
}
