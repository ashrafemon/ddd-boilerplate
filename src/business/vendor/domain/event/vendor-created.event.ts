import { DomainEvent } from '../../../../shared-business/event/domain-event';

export class VendorCreatedEvent extends DomainEvent {
  public static readonly EVENT_TYPE = 'vendor.created';

  public readonly code: string;
  public readonly name: string;

  constructor(vendorId: string, code: string, name: string) {
    super({
      eventType: VendorCreatedEvent.EVENT_TYPE,
      aggregateType: 'Vendor',
      aggregateId: vendorId,
      payload: { code, name },
    });
    this.code = code;
    this.name = name;
  }
}
