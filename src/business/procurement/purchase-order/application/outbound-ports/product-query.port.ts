import { ProductReference } from '@business/catalog/product/public';

export abstract class PurchasableProductPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
