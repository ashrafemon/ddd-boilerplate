import { ProductStatus } from '../types/product.enum';

export class ProductReactivationPolicy {
  static enforceProductReactivation(status: ProductStatus): boolean {
    return status !== ProductStatus.DISCONTINUED;
  }
}
