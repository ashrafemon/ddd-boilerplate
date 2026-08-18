import { ProductReference } from '../../domain/types/purchase-order.types';

export abstract class PurchasableProductQueryPort {
  abstract getPurchasableProduct(id: string): Promise<ProductReference | null>;
}
