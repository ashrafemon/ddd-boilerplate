import { PurchaseOrderReference } from '@business/procurement/purchase-order/public';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public';

export abstract class PurchaseOrderPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
  abstract registerReceipt(
    request: PurchaseOrderReceiptRequest,
  ): Promise<PurchaseOrderReceiptResult>;
  abstract hasReceipts(purchaseOrderId: string): Promise<boolean>;
}
