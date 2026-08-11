import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class VendorUpdatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'vendor.updated';

  constructor(vendorId: string) {
    super({
      eventType: VendorUpdatedEvent.EVENT_TYPE,
      aggregateType: 'Vendor',
      aggregateId: vendorId,
      payload: {},
    });
  }
}
