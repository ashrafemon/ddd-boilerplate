import { DomainEvent } from '@business/shared-business/domain/bases';
import { VendorId } from '../value-objects';

export class VendorDeactivated extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}
