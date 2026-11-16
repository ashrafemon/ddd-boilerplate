import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { CachePort } from '@platform/platform-common/cache/ports/cache.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GrnController } from '../../presentation/http/grn.controller';
import { CreateGrnUseCase } from '../../application/use-cases/create-grn.usecase';
import { AddGrnLineUseCase } from '../../application/use-cases/add-grn-line.usecase';
import { SetGrnLineTrackingUseCase } from '../../application/use-cases/set-grn-line-tracking.usecase';
import { ReceiveGrnUseCase } from '../../application/use-cases/receive-grn.usecase';
import { PostGrnUseCase } from '../../application/use-cases/post-grn.usecase';
import { ReverseGrnUseCase } from '../../application/use-cases/reverse-grn.usecase';
import { RecordInspectionResultUseCase } from '../../application/use-cases/record-inspection-result.usecase';
import { CancelGrnUseCase } from '../../application/use-cases/cancel-grn.usecase';
import { GetGrnUseCase } from '../../application/use-cases/get-grn.usecase';
import { ListGrnsUseCase } from '../../application/use-cases/list-grns.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('GRN API', () => {
  let app: NestFastifyApplication;
  const mocks = {
    create: { execute: jest.fn() },
    addLine: { execute: jest.fn() },
    setTracking: { execute: jest.fn() },
    receive: { execute: jest.fn() },
    post: { execute: jest.fn() },
    reverse: { execute: jest.fn() },
    inspection: { execute: jest.fn() },
    cancel: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrnController],
      providers: [
        { provide: CreateGrnUseCase, useValue: mocks.create },
        { provide: AddGrnLineUseCase, useValue: mocks.addLine },
        { provide: SetGrnLineTrackingUseCase, useValue: mocks.setTracking },
        { provide: ReceiveGrnUseCase, useValue: mocks.receive },
        { provide: PostGrnUseCase, useValue: mocks.post },
        { provide: ReverseGrnUseCase, useValue: mocks.reverse },
        { provide: RecordInspectionResultUseCase, useValue: mocks.inspection },
        { provide: CancelGrnUseCase, useValue: mocks.cancel },
        { provide: GetGrnUseCase, useValue: mocks.get },
        { provide: ListGrnsUseCase, useValue: mocks.list },
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

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('POST /grn creates a GRN', async () => {
    mocks.create.execute.mockResolvedValue(idOf('grn-1'));
    const res = await request(app.getHttpServer())
      .post('/grn')
      .send({ purchaseOrderId: 'po-1' })
      .expect(201);
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN created' });
  });

  it('GET /grn lists GRNs', async () => {
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    const res = await request(app.getHttpServer()).get('/grn').expect(200);
    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'GRNs fetched' });
  });

  it('PATCH /grn/:id/receive receives', async () => {
    mocks.receive.execute.mockResolvedValue(idOf('grn-1'));
    const res = await request(app.getHttpServer()).patch('/grn/grn-1/receive').expect(200);
    expect(mocks.receive.execute).toHaveBeenCalledWith({ id: 'grn-1' });
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN received' });
  });

  it('PATCH /grn/:id/post posts a GRN', async () => {
    mocks.post.execute.mockResolvedValue(idOf('grn-1'));
    const res = await request(app.getHttpServer()).patch('/grn/grn-1/post').send({}).expect(200);
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN posted' });
  });

  it('GET /grn/:id returns a GRN', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'grn-1', grnNumber: 'GRN-1' });
    const res = await request(app.getHttpServer()).get('/grn/grn-1').expect(200);
    expect(res.body).toEqual({
      data: { id: 'grn-1', grnNumber: 'GRN-1' },
      message: 'GRN fetched',
    });
  });

  it('PATCH /grn/:id/complete completes a GRN', async () => {
    mocks.post.execute.mockResolvedValue(idOf('grn-1'));
    const res = await request(app.getHttpServer()).patch('/grn/grn-1/complete').expect(200);
    expect(mocks.post.execute).toHaveBeenCalledWith({ id: 'grn-1' });
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN completed' });
  });
});
