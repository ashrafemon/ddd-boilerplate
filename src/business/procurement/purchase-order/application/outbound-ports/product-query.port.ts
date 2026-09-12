import { ProductReference } from '@business/procurement/product/public';

export abstract class PurchasableProductPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
