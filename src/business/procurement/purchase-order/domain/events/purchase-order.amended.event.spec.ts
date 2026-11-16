import { PurchaseOrderAmended } from './purchase-order.amended.event';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PurchaseOrderAmended', () => {
  it('captures its payload as a domain event', () => {
    const event = new PurchaseOrderAmended('po-1', { total: 10 }, 'price change', 'u-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.reason).toBe('price change');
    expect(event.actorId).toBe('u-1');
  });
});
