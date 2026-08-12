import { Injectable } from '@nestjs/common';
import { GetPurchasableProductUseCase } from '../usecase/get-purchasable-product.usecase';
import {
  PurchasableProductQueryPort,
  ProductReference,
} from '@business/procurement/purchase/application/ports/outbound/product-query.port';

/**
 * Product module's implementation of PurchaseOrder's outbound contract. Lives
 * in the Product module because it adapts the product use case to the
 * consuming module's port — the adapter only calls its own use case, never
 * infrastructure services.
 */
@Injectable()
export class ProductQueryAdapter implements PurchasableProductQueryPort {
  constructor(private readonly getPurchasableProductUseCase: GetPurchasableProductUseCase) {}

  getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.getPurchasableProductUseCase.execute(id);
  }
}
