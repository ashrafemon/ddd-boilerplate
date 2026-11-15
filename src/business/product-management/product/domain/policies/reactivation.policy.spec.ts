import { ProductReactivationPolicy } from './reactivation.policy';
import { ProductStatus } from '../types/product.enum';

describe('ProductReactivationPolicy', () => {
  it('allows reactivating an ACTIVE product', () => {
    expect(ProductReactivationPolicy.enforceProductReactivation(ProductStatus.ACTIVE)).toBe(true);
  });

  it('allows reactivating an INACTIVE product', () => {
    expect(ProductReactivationPolicy.enforceProductReactivation(ProductStatus.INACTIVE)).toBe(true);
  });

  it('blocks reactivating a DISCONTINUED product', () => {
    expect(ProductReactivationPolicy.enforceProductReactivation(ProductStatus.DISCONTINUED)).toBe(
      false,
    );
  });
});
