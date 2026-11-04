import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { VendorId } from '@business/party/vendor/domain/value-objects/vendor-id.vo';

export class VendorUpdated extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}
