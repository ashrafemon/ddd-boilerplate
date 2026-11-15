import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductCreated } from './product.created.event';
import { ProductId } from '../value-objects/product-id.vo';

describe('ProductCreated', () => {
  it('carries product data', () => {
    const event = new ProductCreated(
      ProductId.fromString('p1'),
      'SKU-1',
      'Mouse',
      Money.fromMinorUnits(1999, 'USD'),
      'USD',
    );

    expect(event.sku).toBe('SKU-1');
    expect(event.name).toBe('Mouse');
    expect(event.unitPrice.minorUnits).toBe(1999);
    expect(event.currency).toBe('USD');
    expect(event.eventId).toBeTruthy();
  });
});
