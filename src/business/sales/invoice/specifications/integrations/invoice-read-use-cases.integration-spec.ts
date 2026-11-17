import { NotFoundException } from '@nestjs/common';
import { GetInvoiceUseCase } from '@business/sales/invoice/application/use-cases/get-invoice.usecase';
import { ListInvoicesUseCase } from '@business/sales/invoice/application/use-cases/list-invoices.usecase';
import { InMemoryInvoiceQuery, makeInvoiceQueryRecord } from '@test/support/invoice/invoice.fakes';

describe('Invoice read use cases (integration)', () => {
  it('GetInvoiceUseCase returns the record', async () => {
    const query = new InMemoryInvoiceQuery();
    query.byId.set('inv-1', makeInvoiceQueryRecord());
    const useCase = new GetInvoiceUseCase(query);

    const result = await useCase.execute('inv-1');
    expect(result.invoiceNo).toBe('INV-00000001');
  });

  it('GetInvoiceUseCase throws when missing', async () => {
    const useCase = new GetInvoiceUseCase(new InMemoryInvoiceQuery());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('ListInvoicesUseCase returns a page', async () => {
    const query = new InMemoryInvoiceQuery();
    query.byId.set('inv-1', makeInvoiceQueryRecord());
    query.byId.set('inv-2', makeInvoiceQueryRecord({ id: 'inv-2' }));

    const useCase = new ListInvoicesUseCase(query);
    const result = await useCase.execute({ page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
  });

  it('ListInvoicesUseCase returns an empty page when there are none', async () => {
    const useCase = new ListInvoicesUseCase(new InMemoryInvoiceQuery());
    const result = await useCase.execute({ page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(0);
  });
});
