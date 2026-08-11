import { PurchaseOrderIdOutput } from '../type/purchase-order-command.input';
import { CancelPurchaseOrderInput, RejectPurchaseOrderInput } from '../type/purchase-order-command.input';

/**
 * Public application port: rejects a purchase order.
 */
export abstract class RejectPurchaseOrderPort {
  public abstract execute(input: RejectPurchaseOrderInput): Promise<PurchaseOrderIdOutput>;
}

/**
 * Public application port: cancels a purchase order.
 */
export abstract class CancelPurchaseOrderPort {
  public abstract execute(input: CancelPurchaseOrderInput): Promise<PurchaseOrderIdOutput>;
}

/**
 * Public application port: completes a purchase order.
 */
export abstract class CompletePurchaseOrderPort {
  public abstract execute(input: { purchaseOrderId: string }): Promise<PurchaseOrderIdOutput>;
}
