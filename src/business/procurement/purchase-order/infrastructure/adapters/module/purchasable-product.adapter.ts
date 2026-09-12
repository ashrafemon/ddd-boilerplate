import { Injectable } from '@nestjs/common';
import { PurchasableProductPort } from '@business/procurement/purchase-order/application/outbound-ports/product-query.port';
import { ProductForPurchasePort, ProductReference } from '@business/procurement/product/public';

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
}
