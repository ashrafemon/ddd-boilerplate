import { DomainEvent } from '@business/shared-business/domain/bases';
import { VendorId } from '../value-objects';

export class VendorCreated extends DomainEvent {
  constructor(
    public readonly vendorId: VendorId,
    public readonly code: string,
    public readonly name: string,
  ) {
    super();
  }
}
