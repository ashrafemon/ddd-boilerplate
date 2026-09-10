import { InvoiceReference } from '../contracts/invoice-for-reports.contract';

/**
 * Public read contract this module EXPORTS (reserved for AR/reporting
 * consumers, mirroring GrnForPurchaseOrderPort's reservation pattern).
 */
export abstract class InvoiceForReportsPort {
  abstract getInvoice(id: string): Promise<InvoiceReference | null>;
}
