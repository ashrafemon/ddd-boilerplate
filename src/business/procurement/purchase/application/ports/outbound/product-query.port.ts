import { ProductReference } from '@business/catalog/product/public/contracts/product.contracts';

export abstract class PurchasableProductQueryPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
