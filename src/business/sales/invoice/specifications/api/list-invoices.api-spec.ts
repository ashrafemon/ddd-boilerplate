import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.usecase';
import { InvoiceController } from '../../presentation/http/invoice.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /invoices', () => {
  let api: ApiTestApp;
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: InvoiceController,
      providers: [{ provide: ListInvoicesUseCase, useValue: list }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists invoices', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    const res = await api.http().get('/invoices').expect(200);

    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Invoices fetched' });
  });

  it('passes the paging query through to the use case', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    await api.http().get('/invoices?page=1&pageSize=10').expect(200);

    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10 }));
  });
});
