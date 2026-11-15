import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Product } from './product.aggregate';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';
import { ProductName } from '../value-objects/product-name.vo';
import { ProductStatus } from '../types/product.enum';

function makeProduct(overrides?: { status?: ProductStatus }): Product {
  const now = new Date();
  return Product.instantiate(
    ProductId.fromString('product-1'),
    {
      sku: Sku.create('SKU-001'),
      name: ProductName.create('Wireless Mouse'),
      description: 'A mouse',
      status: overrides?.status ?? ProductStatus.ACTIVE,
      unitPrice: Money.fromMinorUnits(1999, 'USD'),
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    },
    1,
  );
}

describe('Product aggregate', () => {
  describe('isPurchasable', () => {
    it('returns true for ACTIVE', () => {
      expect(makeProduct({ status: ProductStatus.ACTIVE }).isPurchasable()).toBe(true);
    });

    it('returns false for INACTIVE', () => {
      expect(makeProduct({ status: ProductStatus.INACTIVE }).isPurchasable()).toBe(false);
    });

    it('returns false for DISCONTINUED', () => {
      expect(makeProduct({ status: ProductStatus.DISCONTINUED }).isPurchasable()).toBe(false);
    });
  });

  describe('update', () => {
    it('updates the name', () => {
      const product = makeProduct();
      product.update({ name: 'New Name' });
      expect(product.name).toBe('New Name');
    });

    it('updates and trims the description', () => {
      const product = makeProduct();
      product.update({ description: '  New description  ' });
      expect(product.description).toBe('New description');
    });

    it('clears the description when blank', () => {
      const product = makeProduct();
      product.update({ description: '   ' });
      expect(product.description).toBeNull();
    });

    it('raises ProductUpdated', () => {
      const product = makeProduct();
      product.update({ name: 'X' });
      expect(product.pullEvents()).toHaveLength(1);
    });
  });

  describe('changePrice', () => {
    it('updates the unit price', () => {
      const product = makeProduct();
      product.changePrice(Money.fromMinorUnits(2999, 'USD'));
      expect(product.unitPrice.minorUnits).toBe(2999);
    });

    it('rejects a negative price', () => {
      const product = makeProduct();
      expect(() =>
        product.changePrice(Money.ZERO('USD').subtract(Money.fromMinorUnits(1, 'USD'))),
      ).toThrow('Product price cannot be negative');
    });
  });

  describe('status transitions', () => {
    it('deactivates an ACTIVE product', () => {
      const product = makeProduct({ status: ProductStatus.ACTIVE });
      product.deactivate();
      expect(product.status).toBe(ProductStatus.INACTIVE);
    });

    it('discontinues an ACTIVE product', () => {
      const product = makeProduct({ status: ProductStatus.ACTIVE });
      product.discontinue();
      expect(product.status).toBe(ProductStatus.DISCONTINUED);
    });

    it('reactivates an INACTIVE product', () => {
      const product = makeProduct({ status: ProductStatus.INACTIVE });
      product.activate();
      expect(product.status).toBe(ProductStatus.ACTIVE);
    });

    it('cannot reactivate a DISCONTINUED product', () => {
      const product = makeProduct({ status: ProductStatus.DISCONTINUED });
      expect(() => product.activate()).toThrow('Product cannot be reactivated');
    });

    it('raises the matching event', () => {
      const product = makeProduct({ status: ProductStatus.ACTIVE });
      product.deactivate();
      expect(product.pullEvents()).toHaveLength(1);
    });
  });
});
