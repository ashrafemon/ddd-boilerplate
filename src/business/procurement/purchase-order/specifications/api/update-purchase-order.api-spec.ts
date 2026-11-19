import { ConflictException } from '@nestjs/common';
import { UpdatePurchaseOrderUseCase } from '../../application/use-cases/update-purchase-order.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /purchase-orders/:id', () => {
  let api: ApiTestApp;
  const update = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [{ provide: UpdatePurchaseOrderUseCase, useValue: update }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('updates the draft header', async () => {
    update.execute.mockResolvedValue(idOf('po-1'));

    const res = await api
      .http()
      .patch('/purchase-orders/po-1')
      .send({ externalReference: 'EXT-1' })
      .expect(200);

    expect(update.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'po-1', externalReference: 'EXT-1' }),
    );
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order updated' });
  });

  it('maps an update outside DRAFT to 409', async () => {
    update.execute.mockRejectedValue(new ConflictException('order is not editable'));

    await api
      .http()
      .patch('/purchase-orders/po-1')
      .send({ externalReference: 'EXT-1' })
      .expect(409);
  });

  it('rejects an invalid date (400)', async () => {
    await api
      .http()
      .patch('/purchase-orders/po-1')
      .send({ expectedDeliveryDate: 'not-a-date' })
      .expect(400);
    expect(update.execute).not.toHaveBeenCalled();
  });
});
