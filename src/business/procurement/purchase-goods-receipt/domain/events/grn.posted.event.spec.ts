import { GoodsReceiptPosted } from './grn.posted.event';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('GoodsReceiptPosted', () => {
  it('captures its payload as a domain event', () => {
    const event = new GoodsReceiptPosted('grn-1', 'po-1', [
      { grnLineId: 'gl-1', productId: 'p-1', acceptedQuantity: 1, unitPrice: 5 },
    ]);
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.lines).toHaveLength(1);
  });
});
