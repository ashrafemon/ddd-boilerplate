import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';

export class VendorCreated extends DomainEvent {
  constructor(
    public readonly vendorId: VendorId,
    public readonly code: string,
    public readonly name: string,
  ) {
    super();
  }
}
