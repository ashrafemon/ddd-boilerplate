import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public/contracts/purchase-order-receipt.contract';

export abstract class PurchaseOrderPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
  abstract registerReceipt(
    request: PurchaseOrderReceiptRequest,
  ): Promise<PurchaseOrderReceiptResult>;
  abstract hasReceipts(purchaseOrderId: string): Promise<boolean>;
}
