import { ApprovePurchaseOrderInput, ApprovePurchaseOrderOutput } from './approve-purchase-order.port';

/**
 * Facade port: approves a purchase order and starts the post-approval
 * workflow (saga). Other modules use this port when they need the full
 * lifecycle behavior.
 */
export abstract class PurchaseOrderLifecyclePort {
  public abstract approveAndRunPostProcessing(
    input: ApprovePurchaseOrderInput,
  ): Promise<ApprovePurchaseOrderOutput>;
}
