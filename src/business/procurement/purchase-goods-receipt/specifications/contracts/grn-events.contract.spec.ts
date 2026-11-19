import { GrnFactory } from '@business/procurement/purchase-goods-receipt/domain/factories/grn.factory';
import { GrnCreated } from '@business/procurement/purchase-goods-receipt/domain/events/grn.created.event';

describe('GRN events — wire contract', () => {
  function createdEvent(): GrnCreated {
    const grn = GrnFactory.create({
      grnNumber: 'GRN-00000001',
      purchaseOrderId: 'po-1',
      vendorId: 'vendor-1',
      currency: 'USD',
      lines: [
        {
          productId: 'product-1',
          orderedQuantity: 10,
          receivedQuantity: 4,
          unitPrice: 10,
        },
      ],
    });
    return grn.pullEvents()[0] as GrnCreated;
  }

  it('publishes GrnCreated under a stable event type name', () => {
    expect(createdEvent().constructor.name).toBe('GrnCreated');
  });

  it('carries a resolvable envelope: eventId, version, occurredAt', () => {
    const event = createdEvent();

    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
    expect(Number.isInteger(event.version)).toBe(true);
    expect(event.version).toBeGreaterThanOrEqual(1);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('exposes the GRN identity, number and purchase order to consumers', () => {
    const event = createdEvent();

    expect(typeof event.grnId.toString()).toBe('string');
    expect(event.grnNumber).toBe('GRN-00000001');
    expect(event.purchaseOrderId).toBe('po-1');
  });

  it('survives JSON serialisation without losing consumer fields', () => {
    const event = createdEvent();

    const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    expect(serialised.grnId).toBeDefined();
    expect(serialised.grnNumber).toBe('GRN-00000001');
    expect(typeof serialised.occurredAt).toBe('string');
  });
});
