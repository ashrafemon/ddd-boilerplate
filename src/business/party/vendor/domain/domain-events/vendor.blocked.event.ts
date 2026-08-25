import { DomainEvent } from '@business/shared-business/domain/bases';
import { VendorId } from '../value-objects';

export class VendorBlocked extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}
