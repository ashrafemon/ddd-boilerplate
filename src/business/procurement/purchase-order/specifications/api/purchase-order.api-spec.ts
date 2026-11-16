import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { CachePort } from '@platform/platform-common/cache/ports/cache.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { CreatePurchaseOrderUseCase } from '../../application/use-cases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from '../../application/use-cases/add-purchase-order-line.usecase';
import { UpdatePurchaseOrderUseCase } from '../../application/use-cases/update-purchase-order.usecase';
import { UpdatePurchaseOrderLineUseCase } from '../../application/use-cases/update-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from '../../application/use-cases/remove-purchase-order-line.usecase';
import { GetPurchaseOrderReceiptsUseCase } from '../../application/use-cases/get-purchase-order-receipts.usecase';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from '../../application/use-cases/get-purchase-order-remaining-quantities.usecase';
import { SubmitPurchaseOrderUseCase } from '../../application/use-cases/submit-purchase-order.usecase';
import { ApprovePurchaseOrderUseCase } from '../../application/use-cases/approve-purchase-order.usecase';
import { RejectPurchaseOrderUseCase } from '../../application/use-cases/reject-purchase-order.usecase';
import { CancelPurchaseOrderUseCase } from '../../application/use-cases/cancel-purchase-order.usecase';
import { CompletePurchaseOrderUseCase } from '../../application/use-cases/complete-purchase-order.usecase';
import { AmendPurchaseOrderUseCase } from '../../application/use-cases/amend-purchase-order.usecase';
import { IssuePurchaseOrderUseCase } from '../../application/use-cases/issue-purchase-order.usecase';
import { ClosePurchaseOrderUseCase } from '../../application/use-cases/close-purchase-order.usecase';
import { GetPurchaseOrderUseCase } from '../../application/use-cases/get-purchase-order.usecase';
import { ListPurchaseOrdersUseCase } from '../../application/use-cases/list-purchase-orders.usecase';
import { CreateRecurringPurchaseOrderUseCase } from '../../application/use-cases/create-recurring-purchase-order.usecase';
import { CreateRecurringFromPurchaseOrderUseCase } from '../../application/use-cases/create-recurring-from-purchase-order.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('Purchase Order API', () => {
  let app: NestFastifyApplication;
  const mocks = {
    create: { execute: jest.fn() },
    addLine: { execute: jest.fn() },
    update: { execute: jest.fn() },
    updateLine: { execute: jest.fn() },
    removeLine: { execute: jest.fn() },
    receipts: { execute: jest.fn() },
    remaining: { execute: jest.fn() },
    submit: { execute: jest.fn() },
    approve: { execute: jest.fn() },
    reject: { execute: jest.fn() },
    cancel: { execute: jest.fn() },
    complete: { execute: jest.fn() },
    amend: { execute: jest.fn() },
    issue: { execute: jest.fn() },
    close: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
    createRecurring: { execute: jest.fn() },
    createRecurringFrom: { execute: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        { provide: CreatePurchaseOrderUseCase, useValue: mocks.create },
        { provide: AddPurchaseOrderLineUseCase, useValue: mocks.addLine },
        { provide: UpdatePurchaseOrderUseCase, useValue: mocks.update },
        { provide: UpdatePurchaseOrderLineUseCase, useValue: mocks.updateLine },
        { provide: RemovePurchaseOrderLineUseCase, useValue: mocks.removeLine },
        { provide: GetPurchaseOrderReceiptsUseCase, useValue: mocks.receipts },
        { provide: GetPurchaseOrderRemainingQuantitiesUseCase, useValue: mocks.remaining },
        { provide: SubmitPurchaseOrderUseCase, useValue: mocks.submit },
        { provide: ApprovePurchaseOrderUseCase, useValue: mocks.approve },
        { provide: RejectPurchaseOrderUseCase, useValue: mocks.reject },
        { provide: CancelPurchaseOrderUseCase, useValue: mocks.cancel },
        { provide: CompletePurchaseOrderUseCase, useValue: mocks.complete },
        { provide: AmendPurchaseOrderUseCase, useValue: mocks.amend },
        { provide: IssuePurchaseOrderUseCase, useValue: mocks.issue },
        { provide: ClosePurchaseOrderUseCase, useValue: mocks.close },
        { provide: GetPurchaseOrderUseCase, useValue: mocks.get },
        { provide: ListPurchaseOrdersUseCase, useValue: mocks.list },
        { provide: CreateRecurringPurchaseOrderUseCase, useValue: mocks.createRecurring },
        { provide: CreateRecurringFromPurchaseOrderUseCase, useValue: mocks.createRecurringFrom },
        {
          provide: CachePort,
          useValue: {
            get: jest.fn().mockResolvedValue({ status: 'MISS' }),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn(),
            buildKey: jest.fn().mockReturnValue('cache-key'),
          },
        },
        {
          provide: RequestContextPort,
          useValue: {
            require: jest.fn(),
            get: jest.fn(),
            getTenantId: jest.fn().mockReturnValue('tenant-1'),
            getCompanyId: jest.fn().mockReturnValue('company-1'),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /purchase-orders creates a purchase order', async () => {
    mocks.create.execute.mockResolvedValue(idOf('po-1'));
    const res = await request(app.getHttpServer())
      .post('/purchase-orders')
      .send({ vendorId: 'v-1' })
      .expect(201);
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order created' });
  });

  it('GET /purchase-orders lists purchase orders', async () => {
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    const res = await request(app.getHttpServer()).get('/purchase-orders').expect(200);
    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Purchase orders fetched' });
  });

  it('PATCH /purchase-orders/:id/submit submits', async () => {
    mocks.submit.execute.mockResolvedValue(idOf('po-1'));
    const res = await request(app.getHttpServer())
      .patch('/purchase-orders/po-1/submit')
      .expect(200);
    expect(mocks.submit.execute).toHaveBeenCalledWith('po-1');
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order submitted' });
  });

  it('PATCH /purchase-orders/:id/reject rejects with reason', async () => {
    mocks.reject.execute.mockResolvedValue(idOf('po-1'));
    const res = await request(app.getHttpServer())
      .patch('/purchase-orders/po-1/reject')
      .send({ reason: 'invalid' })
      .expect(200);
    expect(mocks.reject.execute).toHaveBeenCalledWith('po-1', 'invalid');
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order rejected' });
  });

  it('PATCH /purchase-orders/:id/lines adds a line', async () => {
    mocks.addLine.execute.mockResolvedValue(idOf('po-1'));
    const res = await request(app.getHttpServer())
      .patch('/purchase-orders/po-1/lines')
      .send({ productId: 'p-1', quantity: 2 })
      .expect(201);
    expect(mocks.addLine.execute).toHaveBeenCalledWith({
      id: 'po-1',
      productId: 'p-1',
      quantity: 2,
    });
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Line added' });
  });

  it('PATCH /purchase-orders/:id/cancel cancels', async () => {
    mocks.cancel.execute.mockResolvedValue(idOf('po-1'));
    const res = await request(app.getHttpServer())
      .patch('/purchase-orders/po-1/cancel')
      .expect(200);
    expect(mocks.cancel.execute).toHaveBeenCalledWith('po-1');
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order cancelled' });
  });
});
