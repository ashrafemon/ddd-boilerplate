import { DomainEvent } from '@business/shared-business/domain/bases';
import { domainEventRegistry } from '@business/shared-business/domain/events';
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

domainEventRegistry.register('VendorCreated', payload => {
  const p = payload as unknown as { vendorId: { value: string }; code: string; name: string };
  return new VendorCreated(VendorId.fromString(p.vendorId.value), p.code, p.name);
});

domainEventRegistry.register('VendorUpdated', payload => {
  const p = payload as unknown as { vendorId: { value: string } };
  return new VendorUpdated(VendorId.fromString(p.vendorId.value));
});

domainEventRegistry.register('VendorActivated', payload => {
  const p = payload as unknown as { vendorId: { value: string } };
  return new VendorActivated(VendorId.fromString(p.vendorId.value));
});

domainEventRegistry.register('VendorDeactivated', payload => {
  const p = payload as unknown as { vendorId: { value: string } };
  return new VendorDeactivated(VendorId.fromString(p.vendorId.value));
});

domainEventRegistry.register('VendorBlocked', payload => {
  const p = payload as unknown as { vendorId: { value: string } };
  return new VendorBlocked(VendorId.fromString(p.vendorId.value));
});
