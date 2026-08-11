import { ApprovePurchaseOrderInput } from '../type/purchase-order-command.input';

export { ApprovePurchaseOrderInput };

export interface ApprovePurchaseOrderOutput {
  purchaseOrderId: string;
  status: string;
  requiresAdditionalApproval: boolean;
}

/**
 * Public application port: approves a purchase order.
 */
export abstract class ApprovePurchaseOrderPort {
  public abstract execute(input: ApprovePurchaseOrderInput): Promise<ApprovePurchaseOrderOutput>;
}
