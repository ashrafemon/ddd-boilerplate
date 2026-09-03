import { ProductReference } from '@business/catalog/product/public';

export abstract class PurchaseOrderQueryPort {
  abstract getPurchaseOrder(id: string): Promise<ProductReference | null>;
}