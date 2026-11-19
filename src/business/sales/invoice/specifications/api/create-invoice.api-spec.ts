import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.usecase';
import { InvoiceController } from '../../presentation/http/invoice.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

const validBody = {
  customerId: '11111111-1111-4111-8111-111111111111',
  lines: [{ description: 'Widget', quantity: 2, unitPrice: 10 }],
};

describe('POST /invoices', () => {
  let api: ApiTestApp;
  const create = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: InvoiceController,
      providers: [{ provide: CreateInvoiceUseCase, useValue: create }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a draft invoice', async () => {
    create.execute.mockResolvedValue(idOf('inv-1'));

    const res = await api.http().post('/invoices').send(validBody).expect(201);

    expect(res.body).toEqual({ data: { id: 'inv-1' }, message: 'Invoice created' });
  });

  it('rejects a non-uuid customerId (400)', async () => {
    await api.http().post('/invoices').send({ customerId: 'acme' }).expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('rejects an empty line set (400)', async () => {
    await api
      .http()
      .post('/invoices')
      .send({ ...validBody, lines: [] })
      .expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('rejects a zero-quantity line (400)', async () => {
    await api
      .http()
      .post('/invoices')
      .send({ ...validBody, lines: [{ description: 'Widget', quantity: 0, unitPrice: 10 }] })
      .expect(400);
  });
});
