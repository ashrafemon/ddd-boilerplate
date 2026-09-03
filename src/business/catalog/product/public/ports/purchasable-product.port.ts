import { ProductReference } from '../contracts/product.contracts';

export abstract class PurchasableProductPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
