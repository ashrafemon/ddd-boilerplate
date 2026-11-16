import { PriceListCreated } from './price-list-created.event';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PriceListCreated', () => {
  it('captures its payload as a domain event', () => {
    const event = new PriceListCreated(PriceListId.fromString('pl-1'), 'Retail', 'PL-1', 'USD');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.name).toBe('Retail');
    expect(event.currency).toBe('USD');
  });
});
