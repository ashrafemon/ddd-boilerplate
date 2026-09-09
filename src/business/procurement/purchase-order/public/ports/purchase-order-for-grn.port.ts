import { PurchaseOrderReference } from '../contracts/purchase-order.contracts';

export abstract class PurchaseOrderForGrnPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
}
