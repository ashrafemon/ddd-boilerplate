import { ProductFactory } from '@business/product-management/product/domain/factories/product.factory';
import { ProductCreated } from '@business/product-management/product/domain/events/product.created.event';
import { Money } from '@business/shared-business/domain/common/value-objects/money';

describe('Product events — wire contract', () => {
  function createdEvent(): ProductCreated {
    const product = ProductFactory.create({
      sku: 'SKU-1',
      name: 'Widget',
      unitPrice: Money.fromDecimal(25, 'USD'),
    });
    return product.pullEvents()[0] as ProductCreated;
  }

  it('publishes ProductCreated under a stable event type name', () => {
    expect(createdEvent().constructor.name).toBe('ProductCreated');
  });

  it('carries a resolvable envelope: eventId, version, occurredAt', () => {
    const event = createdEvent();

    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
    expect(Number.isInteger(event.version)).toBe(true);
    expect(event.version).toBeGreaterThanOrEqual(1);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('exposes the product identity, sku and name to consumers', () => {
    const event = createdEvent();

    expect(typeof event.productId.toString()).toBe('string');
    expect(event.sku).toBe('SKU-1');
    expect(typeof event.name).toBe('string');
  });

  it('survives JSON serialisation without losing consumer fields', () => {
    const event = createdEvent();

    const serialised = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
    expect(serialised.productId).toBeDefined();
    expect(serialised.sku).toBe('SKU-1');
    expect(typeof serialised.occurredAt).toBe('string');
  });
});
