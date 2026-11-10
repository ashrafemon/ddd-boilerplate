import { GeneratedInvoiceResult } from '../contracts/recurring-invoice-generation.contract';

/**
 * Public port for recurring invoice generation orchestration.
 * Lives in the Invoice module because it adapts the module's internal
 * use cases (CreateInvoice, GetInvoice, PostInvoice) to the recurring
 * execution consumer's contract.
 */
export abstract class RecurringInvoiceGenerationPort {
  abstract generateRecurringInvoice(
    customerId: string,
    currency: string,
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
    autoPost: boolean,
  ): Promise<GeneratedInvoiceResult | null>;
}
