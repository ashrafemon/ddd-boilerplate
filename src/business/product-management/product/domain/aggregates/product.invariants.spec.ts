import { ProductInvariants } from './product.invariants';
import { ProductStatus } from '../types/product.enum';

describe('ProductInvariants', () => {
  describe('enforceProductCreate', () => {
    it('accepts a positive price', () => {
      expect(() => ProductInvariants.enforceProductCreate(100)).not.toThrow();
    });

    it('accepts zero', () => {
      expect(() => ProductInvariants.enforceProductCreate(0)).not.toThrow();
    });

    it('rejects a negative price', () => {
      expect(() => ProductInvariants.enforceProductCreate(-1)).toThrow(
        'Product price cannot be negative',
      );
    });
  });

  describe('enforceProductPriceChange', () => {
    it('accepts a positive price', () => {
      expect(() => ProductInvariants.enforceProductPriceChange(50)).not.toThrow();
    });

    it('accepts zero', () => {
      expect(() => ProductInvariants.enforceProductPriceChange(0)).not.toThrow();
    });

    it('rejects a negative price', () => {
      expect(() => ProductInvariants.enforceProductPriceChange(-5)).toThrow(
        'Product price cannot be negative',
      );
    });

    it('rejects NaN', () => {
      expect(() => ProductInvariants.enforceProductPriceChange(Number.NaN)).toThrow(
        'Product price cannot be negative',
      );
    });

    it('rejects Infinity', () => {
      expect(() => ProductInvariants.enforceProductPriceChange(Infinity)).toThrow(
        'Product price cannot be negative',
      );
    });
  });

  describe('enforceProductStatusTransition', () => {
    it.each([
      [ProductStatus.ACTIVE, ProductStatus.INACTIVE],
      [ProductStatus.ACTIVE, ProductStatus.DISCONTINUED],
      [ProductStatus.INACTIVE, ProductStatus.ACTIVE],
      [ProductStatus.INACTIVE, ProductStatus.DISCONTINUED],
    ])('allows %s -> %s', (from, to) => {
      expect(() => ProductInvariants.enforceProductStatusTransition(from, to)).not.toThrow();
    });

    it('rejects DISCONTINUED -> ACTIVE', () => {
      expect(() =>
        ProductInvariants.enforceProductStatusTransition(
          ProductStatus.DISCONTINUED,
          ProductStatus.ACTIVE,
        ),
      ).toThrow('Invalid product status transition');
    });

    it('allows a no-op transition', () => {
      expect(() =>
        ProductInvariants.enforceProductStatusTransition(
          ProductStatus.ACTIVE,
          ProductStatus.ACTIVE,
        ),
      ).not.toThrow();
    });
  });
});
