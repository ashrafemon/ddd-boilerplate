import { GetPurchaseOrderInput, PurchaseOrderOutput } from '../type/purchase-order.output';

/**
 * Public application port of the Purchase bounded context: reads a purchase
 * order.
 */
export abstract class GetPurchaseOrderPort {
  public abstract execute(input: GetPurchaseOrderInput): Promise<PurchaseOrderOutput>;
}
