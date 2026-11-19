import { ConflictException } from '@nestjs/common';
import { AmendPurchaseOrderUseCase } from '../../application/use-cases/amend-purchase-order.usecase';
import { ApprovePurchaseOrderUseCase } from '../../application/use-cases/approve-purchase-order.usecase';
import { CancelPurchaseOrderUseCase } from '../../application/use-cases/cancel-purchase-order.usecase';
import { ClosePurchaseOrderUseCase } from '../../application/use-cases/close-purchase-order.usecase';
import { CompletePurchaseOrderUseCase } from '../../application/use-cases/complete-purchase-order.usecase';
import { IssuePurchaseOrderUseCase } from '../../application/use-cases/issue-purchase-order.usecase';
import { RejectPurchaseOrderUseCase } from '../../application/use-cases/reject-purchase-order.usecase';
import { SubmitPurchaseOrderUseCase } from '../../application/use-cases/submit-purchase-order.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /purchase-orders/:id/{status transitions}', () => {
  let api: ApiTestApp;
  const submit = { execute: jest.fn() };
  const approve = { execute: jest.fn() };
  const reject = { execute: jest.fn() };
  const cancel = { execute: jest.fn() };
  const complete = { execute: jest.fn() };
  const issue = { execute: jest.fn() };
  const close = { execute: jest.fn() };
  const amend = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [
        { provide: SubmitPurchaseOrderUseCase, useValue: submit },
        { provide: ApprovePurchaseOrderUseCase, useValue: approve },
        { provide: RejectPurchaseOrderUseCase, useValue: reject },
        { provide: CancelPurchaseOrderUseCase, useValue: cancel },
        { provide: CompletePurchaseOrderUseCase, useValue: complete },
        { provide: IssuePurchaseOrderUseCase, useValue: issue },
        { provide: ClosePurchaseOrderUseCase, useValue: close },
        { provide: AmendPurchaseOrderUseCase, useValue: amend },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['submit', 'Purchase order submitted', submit],
    ['approve', 'Purchase order approved', approve],
    ['cancel', 'Purchase order cancelled', cancel],
    ['complete', 'Purchase order completed', complete],
    ['issue', 'Purchase order issued', issue],
    ['close', 'Purchase order closed', close],
  ])('%s acts on the order id only', async (action, message, mock) => {
    mock.execute.mockResolvedValue(idOf('po-1'));

    const res = await api.http().patch(`/purchase-orders/po-1/${action}`).expect(200);

    expect(mock.execute).toHaveBeenCalledWith('po-1');
    expect(res.body).toEqual({ data: { id: 'po-1' }, message });
  });

  it('rejects with a reason (and requires one)', async () => {
    reject.execute.mockResolvedValue(idOf('po-1'));

    const res = await api
      .http()
      .patch('/purchase-orders/po-1/reject')
      .send({ reason: 'invalid' })
      .expect(200);

    expect(reject.execute).toHaveBeenCalledWith('po-1', 'invalid');
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order rejected' });
  });

  it('rejects an empty reject reason (400)', async () => {
    await api.http().patch('/purchase-orders/po-1/reject').send({}).expect(400);
    expect(reject.execute).not.toHaveBeenCalled();
  });

  it('amends an issued order with a reason', async () => {
    amend.execute.mockResolvedValue(idOf('po-1'));

    const res = await api
      .http()
      .patch('/purchase-orders/po-1/amend')
      .send({ reason: 'vendor moved the delivery date' })
      .expect(200);

    expect(amend.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'po-1', reason: 'vendor moved the delivery date' }),
    );
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order amended' });
  });

  it('rejects an amend reason shorter than 3 characters (400)', async () => {
    await api.http().patch('/purchase-orders/po-1/amend').send({ reason: 'no' }).expect(400);
    expect(amend.execute).not.toHaveBeenCalled();
  });

  it('maps an illegal transition to 409', async () => {
    submit.execute.mockRejectedValue(new ConflictException('invalid transition'));

    await api.http().patch('/purchase-orders/po-1/submit').send({}).expect(409);
  });
});
