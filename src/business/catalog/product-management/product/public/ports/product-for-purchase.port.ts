import { ProductReference } from '../contracts/product-for-purchase.contract';

export abstract class ProductForPurchasePort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
  /** Batch lookup by SKU (stored upper-case); unknown/non-purchasable SKUs are absent. */
  abstract findPurchasableProductsBySkus(skus: string[]): Promise<ProductReference[]>;
}
