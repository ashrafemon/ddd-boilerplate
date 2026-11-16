import { PriceListLineUpdated } from './price-list-line-updated.event';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PriceListLineUpdated', () => {
  it('captures its payload as a domain event', () => {
    const event = new PriceListLineUpdated(PriceListId.fromString('pl-1'), 'p-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.productId).toBe('p-1');
  });
});
