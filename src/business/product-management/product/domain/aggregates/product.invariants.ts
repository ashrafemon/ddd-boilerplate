import { ProductStatus } from '../types/product.enum';

export class ProductInvariants {
  static enforceProductCreate(unitPrice: number): void {
    if (unitPrice < 0) {
      throw Object.assign(new Error('Product price cannot be negative'), { statusCode: 422 });
    }
  }

  static enforceProductPriceChange(unitPrice: number): void {
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw Object.assign(new Error('Product price cannot be negative'), { statusCode: 422 });
    }
  }

  static enforceProductStatusTransition(status: ProductStatus, to: ProductStatus): void {
    if (status === to) return;

    const allowed: Record<ProductStatus, ProductStatus[]> = {
      [ProductStatus.ACTIVE]: [ProductStatus.INACTIVE, ProductStatus.DISCONTINUED],
      [ProductStatus.INACTIVE]: [ProductStatus.ACTIVE, ProductStatus.DISCONTINUED],
      [ProductStatus.DISCONTINUED]: [],
    };

    if (!allowed[status].includes(to)) {
      throw Object.assign(new Error(`Invalid product status transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  }
}
