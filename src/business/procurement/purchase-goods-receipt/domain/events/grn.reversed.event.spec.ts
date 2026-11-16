import { GoodsReceiptReversed } from './grn.reversed.event';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('GoodsReceiptReversed', () => {
  it('captures its payload as a domain event', () => {
    const event = new GoodsReceiptReversed('grn-2', 'grn-1', 'po-1', [
      { grnLineId: 'gl-1', productId: 'p-1', acceptedQuantity: 1, unitPrice: 5 },
    ]);
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.reversalOfId).toBe('grn-1');
  });
});
