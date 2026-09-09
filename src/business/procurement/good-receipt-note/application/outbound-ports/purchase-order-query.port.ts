import { PurchaseOrderReference } from '@business/procurement/purchase-order/public';

export abstract class PurchaseOrderPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
}
