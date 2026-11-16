import { PriceListLineRemoved } from './price-list-line-removed.event';
import { PriceListId } from '../value-objects/price-list-id.vo';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

describe('PriceListLineRemoved', () => {
  it('captures its payload as a domain event', () => {
    const event = new PriceListLineRemoved(PriceListId.fromString('pl-1'), 'p-1');
    expect(event).toBeInstanceOf(DomainEvent);
    expect(event.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(event.productId).toBe('p-1');
  });
});
