import { NotFoundException } from '@nestjs/common';
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.usecase';
import { InvoiceController } from '../../presentation/http/invoice.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /invoices/:id', () => {
  let api: ApiTestApp;
  const get = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: InvoiceController,
      providers: [{ provide: GetInvoiceUseCase, useValue: get }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the invoice', async () => {
    get.execute.mockResolvedValue({ id: 'inv-1', invoiceNo: 'INV-1' });

    const res = await api.http().get('/invoices/inv-1').expect(200);

    expect(res.body).toEqual({
      data: { id: 'inv-1', invoiceNo: 'INV-1' },
      message: 'Invoice fetched',
    });
  });

  it('maps a missing invoice to 404', async () => {
    get.execute.mockRejectedValue(new NotFoundException('Invoice not found'));

    await api.http().get('/invoices/inv-missing').expect(404);
  });
});
