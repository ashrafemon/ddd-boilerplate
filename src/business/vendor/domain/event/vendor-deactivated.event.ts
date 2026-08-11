import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class VendorDeactivatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'vendor.deactivated';

  constructor(vendorId: string) {
    super({
      eventType: VendorDeactivatedEvent.EVENT_TYPE,
      aggregateType: 'Vendor',
      aggregateId: vendorId,
      payload: {},
    });
  }
}
