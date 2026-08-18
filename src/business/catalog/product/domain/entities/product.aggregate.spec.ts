import { ProductStatus } from '../types/product.types';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductCreated, ProductDiscontinued } from '../events';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { productFactory } from '../factories';

describe('Product aggregate', () => {
  const create = () =>
    productFactory.create({
      sku: 'sku-001',
      name: 'Wireless Mouse',
      unitPrice: Money.fromDecimal('19.99'),
      currency: 'USD',
    });

  it('creates an active product with normalized sku and raises ProductCreated', () => {
    const product = create();

    expect(product.sku).toBe('SKU-001');
    expect(product.status).toBe(ProductStatus.ACTIVE);
    expect(product.unitPrice.amount).toBe(19.99);
    expect(product.pullEvents().length).toBe(1);
  });

  it('rejects empty sku via the invariant registry', () => {
    expect(invariantRegistry.has('product.create')).toBe(true);
    expect(() => productFactory.create({ sku: '  ', name: 'X', unitPrice: Money.ZERO() })).toThrow(
      'SKU cannot be empty',
    );
  });

  it('rejects negative price', () => {
    expect(() =>
      productFactory.create({ sku: 'SKU-1', name: 'X', unitPrice: Money.fromMinorUnits(-5) }),
    ).toThrow('Money cannot be negative');
  });

  it('deactivates and reactivates', () => {
    const product = create();
    product.pullEvents();

    product.deactivate();
    expect(product.status).toBe(ProductStatus.INACTIVE);

    product.activate();
    expect(product.status).toBe(ProductStatus.ACTIVE);
  });

  it('discontinues but cannot reactivate without policy', () => {
    const product = create();
    product.pullEvents();

    product.discontinue();
    expect(product.status).toBe(ProductStatus.DISCONTINUED);

    expect(() => product.activate()).toThrow();
    expect(product.pullEvents().some(e => e instanceof ProductDiscontinued)).toBe(true);
  });

  it('rejects invalid status transition via the invariant registry', () => {
    const product = create();
    product.pullEvents();

    product.deactivate();
    product.pullEvents();

    expect(() => product.discontinue()).not.toThrow();

    const fresh = create();
    fresh.pullEvents();
    fresh.discontinue();
    fresh.pullEvents();
    expect(() => fresh.deactivate()).toThrow();
  });

  it('records created event with correct data', () => {
    const product = create();
    const event = product.pullEvents()[0] as ProductCreated;
    expect(event.sku).toBe('SKU-001');
    expect(event.currency).toBe('USD');
  });
});
