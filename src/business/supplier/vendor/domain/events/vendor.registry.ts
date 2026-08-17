import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { VendorId } from '../value-objects';
import { VendorCreated } from './vendor.created.event';
import { VendorUpdated } from './vendor.updated.event';
import { VendorActivated } from './vendor.activated.event';
import { VendorDeactivated } from './vendor.deactivated.event';
import { VendorBlocked } from './vendor.blocked.event';

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
