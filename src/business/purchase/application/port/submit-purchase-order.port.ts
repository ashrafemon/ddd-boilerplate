import { PurchaseOrderIdInput, PurchaseOrderIdOutput } from '../type/purchase-order-command.input';

/**
 * Public application port: submits a purchase order.
 */
export abstract class SubmitPurchaseOrderPort {
  public abstract execute(input: PurchaseOrderIdInput): Promise<PurchaseOrderIdOutput>;
}
