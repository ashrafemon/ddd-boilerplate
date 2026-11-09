import { Injectable } from '@nestjs/common';
import { PurchasableProductPort } from '@business/procurement/purchase-order/application/outbound-ports/product-query.port';
import { ProductForPurchasePort } from '@business/product-management/product/public/ports/product-for-purchase.port';
import { ProductReference } from '@business/product-management/product/public/contracts/product-for-purchase.contract';

/**
 * Infrastructure adapter that implements PurchaseOrder's PurchasableProductPort
 * by delegating to Product module's public ProductForPurchasePort facade.
 */
@Injectable()
export class PurchasableProductAdapter implements PurchasableProductPort {
  constructor(private readonly productForPurchasePort: ProductForPurchasePort) {}

  getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.productForPurchasePort.getPurchasableProduct(id);
  }

  findPurchasableProductsBySkus(skus: string[]): Promise<ProductReference[]> {
    return this.productForPurchasePort.findPurchasableProductsBySkus(skus);
  }
}
