import { PurchaseOrderCancelled } from './purchase-order.cancelled.event';
import { PurchaseOrderId } from '../value-objects/purchase-order-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PurchaseOrderCancelled', () => {
  it('captures its payload as a domain event', () => {
    const event = new PurchaseOrderCancelled(PurchaseOrderId.fromString('po-1'));
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.purchaseOrderId.toString()).toBe('po-1');
  });
});
