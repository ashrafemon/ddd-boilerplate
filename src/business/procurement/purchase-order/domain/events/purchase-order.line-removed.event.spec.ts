import { PurchaseOrderLineRemoved } from './purchase-order.line-removed.event';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PurchaseOrderLineRemoved', () => {
  it('captures its payload as a domain event', () => {
    const event = new PurchaseOrderLineRemoved(PurchaseOrderId.fromString('po-1'), 'p-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.productId).toBe('p-1');
  });
});
