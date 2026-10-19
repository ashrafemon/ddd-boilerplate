import { PurchaseOrderReference } from '../contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '../contracts/purchase-order-receipt.contract';

export abstract class PurchaseOrderForGrnPort {
  abstract getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null>;
  abstract registerReceipt(
    request: PurchaseOrderReceiptRequest,
  ): Promise<PurchaseOrderReceiptResult>;
  abstract hasReceipts(purchaseOrderId: string): Promise<boolean>;
}
