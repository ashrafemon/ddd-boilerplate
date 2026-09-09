import { ProductReference } from '../contracts/product.contracts';

export abstract class ProductForPurchasePort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
