import { Product, ProductStatus } from './product.aggregate';
import { Money } from '@business/shared-business/domain/money.value-object';
import { ProductCreated, ProductDiscontinued } from '../events/product.events';
import { ProductPolicyViolation } from '../errors/product-policy.error';
import { InvariantException } from '@business/shared-business/errors/invariant-violate.error';

describe('Product aggregate', () => {
  const create = () =>
    Product.create({
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

  it('rejects empty sku', () => {
    expect(() => Product.create({ sku: '  ', name: 'X', unitPrice: Money.ZERO() })).toThrow(
      'SKU cannot be empty',
    );
  });

  it('rejects negative price', () => {
    expect(() =>
      Product.create({ sku: 'SKU-1', name: 'X', unitPrice: Money.fromMinorUnits(-5) }),
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

    expect(() => product.activate()).toThrow(ProductPolicyViolation);
    expect(product.pullEvents().some(e => e instanceof ProductDiscontinued)).toBe(true);
  });

  it('rejects invalid status transition', () => {
    const product = create();
    product.pullEvents();

    product.deactivate();
    product.pullEvents();

    expect(() => product.discontinue()).not.toThrow();

    const fresh = create();
    fresh.pullEvents();
    fresh.discontinue();
    fresh.pullEvents();
    expect(() => fresh.deactivate()).toThrow(InvariantException);
  });

  it('records created event with correct data', () => {
    const product = create();
    const event = product.pullEvents()[0] as ProductCreated;
    expect(event.sku).toBe('SKU-001');
    expect(event.currency).toBe('USD');
  });
});
