export class InvoiceNumberInvariants {
  static enforceInvoiceNumberFormat(invoiceNo: string): void {
    if (!/^INV-[A-Z0-9-]{1,32}$/.test(invoiceNo)) {
      throw Object.assign(new Error('Invoice number must match INV-<identifier>'), {
        statusCode: 422,
      });
    }
  }
}
