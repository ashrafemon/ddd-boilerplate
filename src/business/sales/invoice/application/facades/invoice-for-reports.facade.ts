import { Injectable } from '@nestjs/common';
import { GetInvoiceUseCase } from '../usecases/get-invoice.usecase';
import { InvoiceForReportsPort, InvoiceReference } from '@business/sales/invoice/public';

/**
 * Invoice module's public port implementation: delegates to the module's own
 * query use case; never exposes infrastructure.
 */
@Injectable()
export class InvoiceForReportsFacade extends InvoiceForReportsPort {
  constructor(private readonly getInvoiceUseCase: GetInvoiceUseCase) {
    super();
  }

  async getInvoice(id: string): Promise<InvoiceReference | null> {
    const invoice = await this.getInvoiceUseCase.execute(id);
    if (!invoice) {
      return null;
    }
    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customerId: invoice.customerId,
      status: invoice.status,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount,
      postedAt: invoice.postedAt,
    };
  }
}
