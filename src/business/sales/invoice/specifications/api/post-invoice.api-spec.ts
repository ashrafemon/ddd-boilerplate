import { ConflictException } from '@nestjs/common';
import { PostInvoiceUseCase } from '../../application/use-cases/post-invoice.usecase';
import { InvoiceController } from '../../presentation/http/invoice.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /invoices/:id/post', () => {
  let api: ApiTestApp;
  const post = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: InvoiceController,
      providers: [{ provide: PostInvoiceUseCase, useValue: post }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('posts the invoice', async () => {
    post.execute.mockResolvedValue(idOf('inv-1'));

    const res = await api.http().patch('/invoices/inv-1/post').expect(200);

    expect(post.execute).toHaveBeenCalledWith('inv-1');
    expect(res.body).toEqual({ data: { id: 'inv-1' }, message: 'Invoice posted' });
  });

  it('maps an already-posted invoice to 409', async () => {
    post.execute.mockRejectedValue(new ConflictException('invoice already posted'));

    await api.http().patch('/invoices/inv-1/post').send({}).expect(409);
  });
});
