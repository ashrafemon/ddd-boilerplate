import { InvoiceStatus } from '../types/invoice.enum';

export class InvoicePolicy {
  static enforceInvoicePostAllowed(status: InvoiceStatus, lineCount: number): void {
    if (lineCount < 1) {
      throw Object.assign(new Error('Invoice must have at least one line to post'), {
        statusCode: 422,
      });
    }
    if (status !== InvoiceStatus.DRAFT) {
      throw Object.assign(new Error(`Cannot post invoice in status ${status}`), {
        statusCode: 422,
      });
    }
  }

  static enforceInvoiceCancelAllowed(status: InvoiceStatus): void {
    if (status === InvoiceStatus.POSTED) {
      throw Object.assign(new Error('Cannot cancel a posted invoice'), {
        statusCode: 422,
      });
    }
    if (status === InvoiceStatus.CANCELLED) {
      throw Object.assign(new Error('Invoice is already cancelled'), {
        statusCode: 422,
      });
    }
  }
}
