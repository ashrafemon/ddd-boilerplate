import { Inject, Injectable } from '@nestjs/common';
import {
  ProductQueryPort,
  PRODUCT_QUERY_PORT,
} from '@business/product/ports/inbound/product.query.port';
import {
  PurchasableProductQueryPort,
  ProductReference,
} from '../../ports/outbound/product-query.port';

/**
 * Adapter between PurchaseOrder's outbound port and the Product module's
 * inbound port.
 */
@Injectable()
export class ProductQueryAdapter implements PurchasableProductQueryPort {
  constructor(@Inject(PRODUCT_QUERY_PORT) private readonly productQueryPort: ProductQueryPort) {}

  async getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return this.productQueryPort.getPurchasableProduct(id);
  }
}
