import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { GrnCreated } from './grn.created.event';
import { GrnLineAdded } from './grn.line-added.event';
import { GrnReceived } from './grn.received.event';
import { GrnCompleted } from './grn.completed.event';
import { GrnCancelled } from './grn.cancelled.event';
import { GrnId } from '../value-objects/grn.vos';

domainEventRegistry.register('GrnCreated', payload => {
  const p = payload as unknown as {
    grnId: { value: string };
    grnNumber: string;
    purchaseOrderId: string;
  };
  return new GrnCreated(GrnId.fromString(p.grnId.value), p.grnNumber, p.purchaseOrderId);
});

domainEventRegistry.register('GrnLineAdded', payload => {
  const p = payload as unknown as { grnId: { value: string }; productId: string };
  return new GrnLineAdded(GrnId.fromString(p.grnId.value), p.productId);
});

domainEventRegistry.register('GrnReceived', payload => {
  const p = payload as unknown as { grnId: { value: string } };
  return new GrnReceived(GrnId.fromString(p.grnId.value));
});

domainEventRegistry.register('GrnCompleted', payload => {
  const p = payload as unknown as { grnId: { value: string } };
  return new GrnCompleted(GrnId.fromString(p.grnId.value));
});

domainEventRegistry.register('GrnCancelled', payload => {
  const p = payload as unknown as { grnId: { value: string } };
  return new GrnCancelled(GrnId.fromString(p.grnId.value));
});
