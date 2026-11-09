import { PurchaseOrderReference } from '../contracts/purchase-order-for-billing.contract';
import { BillingProgress } from '../contracts/purchase-order-for-billing.contract';

export abstract class PurchaseOrderForBillingPort {
  abstract getPurchaseOrderForBilling(id: string): Promise<PurchaseOrderReference | null>;
  abstract getBillingProgress(purchaseOrderId: string): Promise<BillingProgress | null>;
}
