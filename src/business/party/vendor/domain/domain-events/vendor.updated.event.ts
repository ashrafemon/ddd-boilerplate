import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';

export class VendorUpdated extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}
