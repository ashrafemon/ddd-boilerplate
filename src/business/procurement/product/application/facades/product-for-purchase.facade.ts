import { Injectable } from '@nestjs/common';
import { GetPurchasableProductUseCase } from '../usecases/get-purchasable-product.usecase';
import { ProductForPurchasePort, ProductReference } from '@business/procurement/product/public';

/**
 * Product module's implementation of PurchaseOrder's outbound contract. Lives
 * in the Product module because it adapts the product use case to the
 * consuming module's port — the adapter only calls its own use case, never
 * infrastructure services.
 */
@Injectable()
export class ProductForPurchaseFacade extends ProductForPurchasePort {
  constructor(private readonly getPurchasableProductUseCase: GetPurchasableProductUseCase) {
    super();
  }

  getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.getPurchasableProductUseCase.execute(id);
  }
}
