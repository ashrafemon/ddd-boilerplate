import { Test, TestingModule } from '@nestjs/testing';
import { CachePort } from '@platform/platform-common/cache/ports/cache.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GrnController } from './grn.controller';
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

describe('GrnController (component)', () => {
  let controller: GrnController;
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

  beforeEach(async () => {
    jest.clearAllMocks();
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
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), buildKey: jest.fn() },
        },
        { provide: RequestContextPort, useValue: { require: jest.fn(), get: jest.fn() } },
      ],
    }).compile();
    controller = module.get(GrnController);
  });

  it('creates a GRN', async () => {
    mocks.create.execute.mockResolvedValue(idOf('grn-1'));
    expect((await controller.create({ purchaseOrderId: 'po-1' } as any)).data).toEqual({
      id: 'grn-1',
    });
  });

  it('adds a line and sets tracking', async () => {
    mocks.addLine.execute.mockResolvedValue(idOf('grn-1'));
    mocks.setTracking.execute.mockResolvedValue(idOf('grn-1'));
    expect((await controller.addLine('grn-1', { productId: 'p-1' } as any)).data).toEqual({
      id: 'grn-1',
    });
    await controller.setTracking('grn-1', 'p-1', { entries: [{ lot: 'L1' }] } as any);
    expect(mocks.setTracking.execute).toHaveBeenCalledWith({
      id: 'grn-1',
      productId: 'p-1',
      entries: [{ lot: 'L1' }],
    });
  });

  it('receives, posts, reverses and cancels', async () => {
    mocks.receive.execute.mockResolvedValue(idOf('grn-1'));
    mocks.post.execute.mockResolvedValue(idOf('grn-1'));
    mocks.reverse.execute.mockResolvedValue(idOf('grn-1'));
    mocks.cancel.execute.mockResolvedValue(idOf('grn-1'));
    expect((await controller.receive('grn-1')).data).toEqual({ id: 'grn-1' });
    expect((await controller.complete('grn-1')).data).toEqual({ id: 'grn-1' });
    expect((await controller.post('grn-1', {} as any)).data).toEqual({ id: 'grn-1' });
    expect((await controller.reverse('grn-1', { reason: 'x' } as any)).data).toEqual({
      id: 'grn-1',
    });
    expect((await controller.cancel('grn-1')).data).toEqual({ id: 'grn-1' });
  });

  it('records inspection results', async () => {
    mocks.inspection.execute.mockResolvedValue(idOf('grn-1'));
    await controller.recordInspection('grn-1', { lines: [] });
    expect(mocks.inspection.execute).toHaveBeenCalledWith({ id: 'grn-1', lines: [] });
  });

  it('gets and lists GRNs', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'grn-1' });
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    expect((await controller.get('grn-1')).data).toEqual({ id: 'grn-1' });
    expect((await controller.list({} as any)).data).toEqual({ items: [], total: 0 });
  });
});
