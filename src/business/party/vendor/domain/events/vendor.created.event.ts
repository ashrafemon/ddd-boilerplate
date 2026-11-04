import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { VendorId } from '@business/party/vendor/domain/value-objects/vendor-id.vo';

export class VendorCreated extends DomainEvent {
  constructor(
    public readonly vendorId: VendorId,
    public readonly code: string,
    public readonly name: string,
  ) {
    super();
  }
}
