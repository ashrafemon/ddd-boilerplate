import { PriceListDeactivated } from './price-list-deactivated.event';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PriceListDeactivated', () => {
  it('captures its payload as a domain event', () => {
    const event = new PriceListDeactivated(PriceListId.fromString('pl-1'));
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.priceListId.toString()).toBe('pl-1');
  });
});
