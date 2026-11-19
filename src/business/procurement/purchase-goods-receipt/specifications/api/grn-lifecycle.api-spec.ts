import { ConflictException } from '@nestjs/common';
import { CancelGrnUseCase } from '../../application/use-cases/cancel-grn.usecase';
import { PostGrnUseCase } from '../../application/use-cases/post-grn.usecase';
import { ReceiveGrnUseCase } from '../../application/use-cases/receive-grn.usecase';
import { RecordInspectionResultUseCase } from '../../application/use-cases/record-inspection-result.usecase';
import { ReverseGrnUseCase } from '../../application/use-cases/reverse-grn.usecase';
import { GrnController } from '../../presentation/http/grn.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /grn/:id/{receive,inspection,post,cancel,reverse}', () => {
  let api: ApiTestApp;
  const receive = { execute: jest.fn() };
  const inspection = { execute: jest.fn() };
  const post = { execute: jest.fn() };
  const cancel = { execute: jest.fn() };
  const reverse = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: GrnController,
      providers: [
        { provide: ReceiveGrnUseCase, useValue: receive },
        { provide: RecordInspectionResultUseCase, useValue: inspection },
        { provide: PostGrnUseCase, useValue: post },
        { provide: CancelGrnUseCase, useValue: cancel },
        { provide: ReverseGrnUseCase, useValue: reverse },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('receives the GRN', async () => {
    receive.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api.http().patch('/grn/grn-1/receive').expect(200);

    expect(receive.execute).toHaveBeenCalledWith({ id: 'grn-1' });
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN received' });
  });

  it('records an inspection result', async () => {
    inspection.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api
      .http()
      .patch('/grn/grn-1/inspection')
      .send({
        lines: [
          {
            productId: '33333333-3333-4333-8333-333333333333',
            acceptedQuantity: 4,
            rejectedQuantity: 1,
          },
        ],
      })
      .expect(200);

    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'Inspection result recorded' });
  });

  it('rejects an inspection without lines (400)', async () => {
    await api.http().patch('/grn/grn-1/inspection').send({ lines: [] }).expect(400);
    expect(inspection.execute).not.toHaveBeenCalled();
  });

  it('posts the GRN with an optional idempotency key', async () => {
    post.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api
      .http()
      .patch('/grn/grn-1/post')
      .send({ idempotencyKey: 'post-key-1' })
      .expect(200);

    expect(post.execute).toHaveBeenCalledWith({ id: 'grn-1', idempotencyKey: 'post-key-1' });
    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN posted' });
  });

  it('reverses the GRN', async () => {
    reverse.execute.mockResolvedValue(idOf('grn-2'));

    const res = await api.http().patch('/grn/grn-1/reverse').send({}).expect(200);

    expect(res.body).toEqual({ data: { id: 'grn-2' }, message: 'GRN reversed' });
  });

  it('cancels the GRN', async () => {
    cancel.execute.mockResolvedValue(idOf('grn-1'));

    const res = await api.http().patch('/grn/grn-1/cancel').send({ reason: 'nope' }).expect(200);

    expect(res.body).toEqual({ data: { id: 'grn-1' }, message: 'GRN cancelled' });
  });

  it('maps a posted GRN cancellation to 409', async () => {
    cancel.execute.mockRejectedValue(new ConflictException('posted GRN cannot be cancelled'));

    await api.http().patch('/grn/grn-1/cancel').send({ reason: 'nope' }).expect(409);
  });

  it('maps an illegal post to 409', async () => {
    post.execute.mockRejectedValue(new ConflictException('GRN must be received before posting'));

    await api.http().patch('/grn/grn-1/post').send({}).expect(409);
  });
});
