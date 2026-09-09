import { PurchaseOrderReference } from '../contracts/purchase-order-for-grn.contract';

export abstract class PurchaseOrderForGrnPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
}
