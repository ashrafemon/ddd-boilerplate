import { ProductReference } from '@business/procurement/product/public/contracts/product-for-purchase.contract';

export abstract class PurchasableProductPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
  abstract findPurchasableProductsBySkus(skus: string[]): Promise<ProductReference[]>;
}
