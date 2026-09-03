import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';

export class VendorCreatedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly vendorId: VendorId,
    public readonly code: string,
    public readonly name: string,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly address: string | null,
  ) {
    super();
  }
}

export class VendorUpdatedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly vendorId: VendorId,
    public readonly name: string,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly address: string | null,
  ) {
    super();
  }
}

export class VendorActivatedIntegrationEvent extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}

export class VendorDeactivatedIntegrationEvent extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}

export class VendorBlockedIntegrationEvent extends DomainEvent {
  constructor(public readonly vendorId: VendorId) {
    super();
  }
}