import { ProductReference } from '../contracts/product-for-purchase.contract';

export abstract class ProductForPurchasePort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
