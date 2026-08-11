import { CreatePurchaseOrderInput, CreatePurchaseOrderOutput } from '../type/create-purchase-order.input';

/**
 * Public application port of the Purchase bounded context: creates a purchase
 * order.
 */
export abstract class CreatePurchaseOrderPort {
  public abstract execute(input: CreatePurchaseOrderInput): Promise<CreatePurchaseOrderOutput>;
}
