import { PurchaseOrderReference } from '../contracts/purchase-order.contracts';

export abstract class PurchaseOrderQueryPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
}