import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { VendorId } from '../value-objects/vendor-id.vo';

export class VendorCreated extends DomainEvent {
  constructor(
    public readonly vendorId: VendorId,
    public readonly code: string,
    public readonly name: string,
  ) {
    super();
  }
}

export class VendorUpdated extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}

export class VendorActivated extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}

export class VendorDeactivated extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}

export class VendorBlocked extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}
