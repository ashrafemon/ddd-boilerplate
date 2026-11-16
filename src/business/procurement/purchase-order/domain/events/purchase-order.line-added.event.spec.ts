import { PurchaseOrderLineAdded } from './purchase-order.line-added.event';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PurchaseOrderLineAdded', () => {
  it('captures its payload as a domain event', () => {
    const event = new PurchaseOrderLineAdded(PurchaseOrderId.fromString('po-1'), 'p-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.productId).toBe('p-1');
  });
});
