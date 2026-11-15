import { InvoiceForReportsFacade } from '@business/sales/invoice/application/facades/invoice-for-reports.facade';
import { GetInvoiceUseCase } from '@business/sales/invoice/application/use-cases/get-invoice.usecase';
import { InMemoryInvoiceQuery, makeInvoiceQueryRecord } from '@test/support/invoice/invoice.fakes';

describe('InvoiceForReportsFacade (integration)', () => {
  it('maps an invoice to the reports contract', async () => {
    const query = new InMemoryInvoiceQuery();
    query.byId.set('inv-1', makeInvoiceQueryRecord());
    const facade = new InvoiceForReportsFacade(new GetInvoiceUseCase(query));

    const result = await facade.getInvoice('inv-1');
    expect(result).toMatchObject({
      id: 'inv-1',
      invoiceNo: 'INV-00000001',
      customerId: 'customer-1',
      totalAmount: 1000,
      currency: 'USD',
    });
  });
});
