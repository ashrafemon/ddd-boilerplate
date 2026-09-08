import { ProductReference } from '@business/catalog/product/public';

export abstract class PurchasableProductQueryPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
