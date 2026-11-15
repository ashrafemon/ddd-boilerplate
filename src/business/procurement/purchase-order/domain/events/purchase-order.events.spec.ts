import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { PurchaseOrderApproved } from './purchase-order.approved.event';
import { PurchaseOrderCancelled } from './purchase-order.cancelled.event';
import { PurchaseOrderCompleted } from './purchase-order.completed.event';
import { PurchaseOrderIssued } from './purchase-order.issued.event';
import { PurchaseOrderLineAdded } from './purchase-order.line-added.event';
import { PurchaseOrderLineRemoved } from './purchase-order.line-removed.event';
import { PurchaseOrderRejected } from './purchase-order.rejected.event';
import { PurchaseOrderSubmitted } from './purchase-order.submitted.event';
import { PurchaseOrderAmended } from './purchase-order.amended.event';
import { PurchaseOrderCreated } from './purchase-order.created.event';

const poId = PurchaseOrderId.fromString('po-1');

describe('PurchaseOrder domain events', () => {
  it.each([
    ['PurchaseOrderCreated', () => new PurchaseOrderCreated(poId, 'PO-1', 'ven-1')],
    ['PurchaseOrderApproved', () => new PurchaseOrderApproved(poId)],
    ['PurchaseOrderCancelled', () => new PurchaseOrderCancelled(poId)],
    ['PurchaseOrderCompleted', () => new PurchaseOrderCompleted(poId)],
    ['PurchaseOrderIssued', () => new PurchaseOrderIssued(poId)],
    ['PurchaseOrderRejected', () => new PurchaseOrderRejected(poId, 'no budget')],
    ['PurchaseOrderSubmitted', () => new PurchaseOrderSubmitted(poId, 'PO-1', 'ven-1')],
    ['PurchaseOrderLineAdded', () => new PurchaseOrderLineAdded(poId, 'prod-1')],
    ['PurchaseOrderLineRemoved', () => new PurchaseOrderLineRemoved(poId, 'prod-1')],
    ['PurchaseOrderAmended', () => new PurchaseOrderAmended('po-1', { a: 1 }, 'reason', 'actor-1')],
  ])('%s carries domain-event metadata', (_name, factory) => {
    const event = factory();
    expect(event.eventId).toBeTruthy();
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.version).toBe(1);
  });

  it('PurchaseOrderCreated exposes orderNumber and vendorId', () => {
    const event = new PurchaseOrderCreated(poId, 'PO-1', 'ven-1');
    expect(event.orderNumber).toBe('PO-1');
    expect(event.vendorId).toBe('ven-1');
    expect(event.purchaseOrderId.value).toBe('po-1');
  });

  it('PurchaseOrderRejected exposes the reason', () => {
    const event = new PurchaseOrderRejected(poId, 'no budget');
    expect(event.reason).toBe('no budget');
  });

  it('PurchaseOrderSubmitted exposes orderNumber and vendorId', () => {
    const event = new PurchaseOrderSubmitted(poId, 'PO-9', 'ven-9');
    expect(event.orderNumber).toBe('PO-9');
    expect(event.vendorId).toBe('ven-9');
  });

  it('PurchaseOrderLineAdded exposes the productId', () => {
    const event = new PurchaseOrderLineAdded(poId, 'prod-9');
    expect(event.productId).toBe('prod-9');
  });

  it('PurchaseOrderLineRemoved exposes the productId', () => {
    const event = new PurchaseOrderLineRemoved(poId, 'prod-9');
    expect(event.productId).toBe('prod-9');
  });

  it('PurchaseOrderAmended exposes changes, reason and actor', () => {
    const event = new PurchaseOrderAmended('po-1', { price: 10 }, 'price fix', 'actor-1');
    expect(event.changes).toEqual({ price: 10 });
    expect(event.reason).toBe('price fix');
    expect(event.actorId).toBe('actor-1');
  });
});
