import { domainEventRegistry } from '@business/shared-business/domain/registries/domain-event.registry';
import { PurchaseOrderCreated } from './purchase-order.created.event';
import { PurchaseOrderLineAdded } from './purchase-order.line-added.event';
import { PurchaseOrderLineRemoved } from './purchase-order.line-removed.event';
import { PurchaseOrderSubmitted } from './purchase-order.submitted.event';
import { PurchaseOrderApproved } from './purchase-order.approved.event';
import { PurchaseOrderRejected } from './purchase-order.rejected.event';
import { PurchaseOrderCancelled } from './purchase-order.cancelled.event';
import { PurchaseOrderCompleted } from './purchase-order.completed.event';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';

domainEventRegistry.register('PurchaseOrderCreated', payload => {
  const p = payload as unknown as {
    purchaseOrderId: { value: string };
    orderNumber: string;
    vendorId: string;
  };
  return new PurchaseOrderCreated(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.orderNumber,
    p.vendorId,
  );
});

domainEventRegistry.register('PurchaseOrderLineAdded', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string }; productId: string };
  return new PurchaseOrderLineAdded(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.productId,
  );
});

domainEventRegistry.register('PurchaseOrderLineRemoved', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string }; productId: string };
  return new PurchaseOrderLineRemoved(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.productId,
  );
});

domainEventRegistry.register('PurchaseOrderSubmitted', payload => {
  const p = payload as unknown as {
    purchaseOrderId: { value: string };
    orderNumber: string;
    vendorId: string;
  };
  return new PurchaseOrderSubmitted(
    PurchaseOrderId.fromString(p.purchaseOrderId.value),
    p.orderNumber,
    p.vendorId,
  );
});

domainEventRegistry.register('PurchaseOrderApproved', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string } };
  return new PurchaseOrderApproved(PurchaseOrderId.fromString(p.purchaseOrderId.value));
});

domainEventRegistry.register('PurchaseOrderRejected', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string }; reason: string };
  return new PurchaseOrderRejected(PurchaseOrderId.fromString(p.purchaseOrderId.value), p.reason);
});

domainEventRegistry.register('PurchaseOrderCancelled', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string } };
  return new PurchaseOrderCancelled(PurchaseOrderId.fromString(p.purchaseOrderId.value));
});

domainEventRegistry.register('PurchaseOrderCompleted', payload => {
  const p = payload as unknown as { purchaseOrderId: { value: string } };
  return new PurchaseOrderCompleted(PurchaseOrderId.fromString(p.purchaseOrderId.value));
});
