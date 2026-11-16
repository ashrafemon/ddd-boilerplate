import { PriceListUpdated } from './price-list-updated.event';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PriceListUpdated', () => {
  it('captures its payload as a domain event', () => {
    const event = new PriceListUpdated(
      PriceListId.fromString('pl-1'),
      'Retail',
      'PL-1',
      'USD',
      null,
      null,
    );
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.name).toBe('Retail');
  });
});
