import { PurchaseOrderFactory } from '@business/procurement/purchase-order/domain/factories/purchase-order.factory';
import { PurchaseOrderCreated } from '@business/procurement/purchase-order/domain/events/purchase-order.created.event';

describe('Purchase order events — wire contract', () => {
  function createdEvent(): PurchaseOrderCreated {
    const purchaseOrder = PurchaseOrderFactory.create({
      orderNumber: 'PO-00000001',
      vendorId: 'vendor-1',
    });
    return purchaseOrder.pullEvents()[0] as PurchaseOrderCreated;
  }

  it('publishes PurchaseOrderCreated under a stable event type name', () => {
    expect(createdEvent().constructor.name).toBe('PurchaseOrderCreated');
  });

  it('carries a resolvable envelope: eventId, version, occurredAt', () => {
    const event = createdEvent();

    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
    expect(Number.isInteger(event.version)).toBe(true);
    expect(event.version).toBeGreaterThanOrEqual(1);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('exposes the order identity, number and vendor to consumers', () => {
    const event = createdEvent();

    expect(typeof event.purchaseOrderId.toString()).toBe('string');
    expect(event.orderNumber).toBe('PO-00000001');
    expect(event.vendorId).toBe('vendor-1');
  });

  it('keeps the vendor id a plain string (GRN/finance consumers rely on it)', () => {
    const event = createdEvent();

    expect(typeof event.vendorId).toBe('string');
  });

  it('survives JSON serialisation without losing consumer fields', () => {
    const event = createdEvent();

    const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    expect(serialised.purchaseOrderId).toBeDefined();
    expect(serialised.orderNumber).toBe('PO-00000001');
    expect(typeof serialised.occurredAt).toBe('string');
  });
});
