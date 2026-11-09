import { Injectable } from '@nestjs/common';
import { GetPurchasableProductUseCase } from '../use-cases/get-purchasable-product.usecase';
import { FindPurchasableProductsBySkusUseCase } from '../use-cases/find-purchasable-products-by-skus.usecase';
import { ProductForPurchasePort } from '@business/product-management/product/public/ports/product-for-purchase.port';
import { ProductReference } from '@business/product-management/product/public/contracts/product-for-purchase.contract';

/**
 * Product module's implementation of PurchaseOrder's outbound contract. Lives
 * in the Product module because it adapts the product use case to the
 * consuming module's port — the adapter only calls its own use case, never
 * infrastructure services.
 */
@Injectable()
export class ProductForPurchaseFacade extends ProductForPurchasePort {
  constructor(
    private readonly getPurchasableProductUseCase: GetPurchasableProductUseCase,
    private readonly findPurchasableProductsBySkusUseCase: FindPurchasableProductsBySkusUseCase,
  ) {
    super();
  }

  getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.getPurchasableProductUseCase.execute(id);
  }

  findPurchasableProductsBySkus(skus: string[]): Promise<ProductReference[]> {
    return this.findPurchasableProductsBySkusUseCase.execute(skus);
  }
}
