import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductFactory } from './product.factory';
import { ProductStatus } from '../types/product.enum';

describe('ProductFactory', () => {
  it('creates active product with defaults', () => {
    const product = ProductFactory.create({
      sku: 'SKU-001',
      name: 'Wireless Mouse',
      unitPrice: Money.fromMinorUnits(1999, 'USD'),
    });

    expect(product.sku).toBe('SKU-001');
    expect(product.name).toBe('Wireless Mouse');
    expect(product.status).toBe(ProductStatus.ACTIVE);
    expect(product.currency).toBe('USD');
    expect(product.unitPrice.minorUnits).toBe(1999);
    expect(product.isPurchasable()).toBe(true);
  });

  it('creates product with custom currency', () => {
    const product = ProductFactory.create({
      sku: 'SKU-002',
      name: 'Keyboard',
      unitPrice: Money.fromMinorUnits(8950, 'EUR'),
      currency: 'EUR',
    });

    expect(product.currency).toBe('EUR');
  });

  it('rejects negative price (Money.fromMinorUnits rejects before factory sees it)', () => {
    expect(() => Money.fromMinorUnits(-100, 'USD')).toThrow('Money cannot be negative');
  });

  it('emits ProductCreated event on create', () => {
    const product = ProductFactory.create({
      sku: 'SKU-004',
      name: 'Dock',
      unitPrice: Money.fromMinorUnits(5999, 'USD'),
    });
    const events = product.pullEvents();
    expect(events).toHaveLength(1);
  });
});
