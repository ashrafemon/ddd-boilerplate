import { PriceListFactory } from '@business/product-management/product-pricing/domain/factories/price-list.factory';
import { PriceListCreated } from '@business/product-management/product-pricing/domain/events/price-list-created.event';

describe('Price list events — wire contract', () => {
  function createdEvent(): PriceListCreated {
    const priceList = PriceListFactory.create({
      name: 'Standard',
      code: 'STD',
      currency: 'USD',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    });
    return priceList.pullEvents()[0] as PriceListCreated;
  }

  it('publishes PriceListCreated under a stable event type name', () => {
    expect(createdEvent().constructor.name).toBe('PriceListCreated');
  });

  it('carries a resolvable envelope: eventId, version, occurredAt', () => {
    const event = createdEvent();

    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
    expect(Number.isInteger(event.version)).toBe(true);
    expect(event.version).toBeGreaterThanOrEqual(1);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('exposes the price list identity and its code to consumers', () => {
    const event = createdEvent();

    expect(typeof event.priceListId.toString()).toBe('string');
    expect(event.code).toBe('STD');
    expect(typeof event.name).toBe('string');
  });

  it('survives JSON serialisation without losing consumer fields', () => {
    const event = createdEvent();

    const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    expect(serialised.priceListId).toBeDefined();
    expect(serialised.code).toBe('STD');
    expect(typeof serialised.occurredAt).toBe('string');
  });
});
