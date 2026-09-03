import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { GrnCreated } from '../events/grn.created.event';
import { GrnId } from '../value-objects/grn.vos';

domainEventRegistry.register('grn.created', {
  deserialize: (p: { grnId: { value: string }; grnNumber: string; purchaseOrderId: string }) =>
    new GrnCreated(GrnId.fromString(p.grnId.value), p.grnNumber, p.purchaseOrderId),
});

domainEventRegistry.register('grn.line-added', {
  deserialize: (p: { grnId: { value: string }; productId: string }) =>
    new GrnLineAdded(GrnId.fromString(p.grnId.value), p.productId),
});

domainEventRegistry.register('grn.received', {
  deserialize: (p: { grnId: { value: string } }) =>
    new GrnReceived(GrnId.fromString(p.grnId.value)),
});

domainEventRegistry.register('grn.completed', {
  deserialize: (p: { grnId: { value: string } }) =>
    new GrnCompleted(GrnId.fromString(p.grnId.value)),
});

domainEventRegistry.register('grn.cancelled', {
  deserialize: (p: { grnId: { value: string } }) =>
    new GrnCancelled(GrnId.fromString(p.grnId.value)),
});