import { PurchaseOrderCreated } from './purchase-order.created.event';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PurchaseOrderCreated', () => {
  it('captures its payload as a domain event', () => {
    const event = new PurchaseOrderCreated(PurchaseOrderId.fromString('po-1'), 'PO-1', 'v-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.orderNumber).toBe('PO-1');
    expect(event.vendorId).toBe('v-1');
  });
});
