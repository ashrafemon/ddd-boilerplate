import { PurchaseOrderRejected } from './purchase-order.rejected.event';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PurchaseOrderRejected', () => {
  it('captures its payload as a domain event', () => {
    const event = new PurchaseOrderRejected(PurchaseOrderId.fromString('po-1'), 'bad');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.reason).toBe('bad');
  });
});
