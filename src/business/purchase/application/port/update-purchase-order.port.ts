import { UpdatePurchaseOrderInput, UpdatePurchaseOrderOutput } from '../type/update-purchase-order.input';

/**
 * Public application port of the Purchase bounded context: updates a purchase
 * order.
 */
export abstract class UpdatePurchaseOrderPort {
  public abstract execute(input: UpdatePurchaseOrderInput): Promise<UpdatePurchaseOrderOutput>;
}
