import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { InvoiceController } from '../../presentation/http/invoice.controller';
import { CreateInvoiceUseCase } from '../../application/use-cases/create-invoice.usecase';
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.usecase';
import { ListInvoicesUseCase } from '../../application/use-cases/list-invoices.usecase';
import { PostInvoiceUseCase } from '../../application/use-cases/post-invoice.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('Invoice API', () => {
  let app: NestFastifyApplication;
  const mocks = {
    create: { execute: jest.fn() },
    post: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: CreateInvoiceUseCase, useValue: mocks.create },
        { provide: PostInvoiceUseCase, useValue: mocks.post },
        { provide: GetInvoiceUseCase, useValue: mocks.get },
        { provide: ListInvoicesUseCase, useValue: mocks.list },
      ],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('POST /invoices creates a draft invoice', async () => {
    mocks.create.execute.mockResolvedValue(idOf('inv-1'));
    const res = await request(app.getHttpServer())
      .post('/invoices')
      .send({ customerName: 'Acme' })
      .expect(201);
    expect(res.body).toEqual({ data: { id: 'inv-1' }, message: 'Invoice created' });
  });

  it('GET /invoices lists invoices', async () => {
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    const res = await request(app.getHttpServer()).get('/invoices').expect(200);
    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Invoices fetched' });
  });

  it('PATCH /invoices/:id/post posts an invoice', async () => {
    mocks.post.execute.mockResolvedValue(idOf('inv-1'));
    const res = await request(app.getHttpServer()).patch('/invoices/inv-1/post').expect(200);
    expect(mocks.post.execute).toHaveBeenCalledWith('inv-1');
    expect(res.body).toEqual({ data: { id: 'inv-1' }, message: 'Invoice posted' });
  });

  it('GET /invoices/:id returns an invoice', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'inv-1', invoiceNo: 'INV-1' });
    const res = await request(app.getHttpServer()).get('/invoices/inv-1').expect(200);
    expect(res.body).toEqual({
      data: { id: 'inv-1', invoiceNo: 'INV-1' },
      message: 'Invoice fetched',
    });
  });
});
