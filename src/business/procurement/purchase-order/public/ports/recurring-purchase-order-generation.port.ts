import { GeneratedPurchaseOrderResult } from '../contracts/recurring-purchase-order-generation.contract';

/**
 * Public port for recurring purchase order generation orchestration.
 * Lives in the PurchaseOrder module because it adapts the module's internal
 * use cases (CreatePurchaseOrder, AddPurchaseOrderLine, GetPurchaseOrder,
 * SubmitPurchaseOrder) to the recurring execution consumer's contract.
 */
export abstract class RecurringPurchaseOrderGenerationPort {
  abstract generateRecurringPurchaseOrder(
    vendorId: string,
    currency: string,
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
    autoPost: boolean,
  ): Promise<GeneratedPurchaseOrderResult | null>;
}
