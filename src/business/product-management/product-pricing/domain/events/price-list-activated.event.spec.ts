import { PriceListActivated } from './price-list-activated.event';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PriceListActivated', () => {
  it('captures its payload as a domain event', () => {
    const event = new PriceListActivated(PriceListId.fromString('pl-1'));
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.priceListId.toString()).toBe('pl-1');
  });
});
