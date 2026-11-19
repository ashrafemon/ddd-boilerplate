import { AddPurchaseOrderLineUseCase } from '../../application/use-cases/add-purchase-order-line.usecase';
import { RemovePurchaseOrderLineUseCase } from '../../application/use-cases/remove-purchase-order-line.usecase';
import { UpdatePurchaseOrderLineUseCase } from '../../application/use-cases/update-purchase-order-line.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

const productId = '33333333-3333-4333-8333-333333333333';

describe('PATCH|DELETE /purchase-orders/:id/lines', () => {
  let api: ApiTestApp;
  const addLine = { execute: jest.fn() };
  const updateLine = { execute: jest.fn() };
  const removeLine = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [
        { provide: AddPurchaseOrderLineUseCase, useValue: addLine },
        { provide: UpdatePurchaseOrderLineUseCase, useValue: updateLine },
        { provide: RemovePurchaseOrderLineUseCase, useValue: removeLine },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('adds a line', async () => {
    addLine.execute.mockResolvedValue(idOf('po-1'));

    const res = await api
      .http()
      .patch('/purchase-orders/po-1/lines')
      .send({ productId, quantity: 2, unitPrice: 10 })
      .expect(201);

    expect(addLine.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'po-1', productId, quantity: 2 }),
    );
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Line added' });
  });

  it('rejects a non-uuid productId (400)', async () => {
    await api
      .http()
      .patch('/purchase-orders/po-1/lines')
      .send({ productId: 'p-1', quantity: 2, unitPrice: 10 })
      .expect(400);
    expect(addLine.execute).not.toHaveBeenCalled();
  });

  it('rewrites an existing line', async () => {
    updateLine.execute.mockResolvedValue(idOf('po-1'));

    const res = await api
      .http()
      .patch(`/purchase-orders/po-1/lines/${productId}`)
      .send({ quantity: 3, unitPrice: 11 })
      .expect(200);

    expect(updateLine.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'po-1', productId, quantity: 3 }),
    );
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Purchase order line updated' });
  });

  it('removes a line', async () => {
    removeLine.execute.mockResolvedValue(idOf('po-1'));

    const res = await api.http().delete(`/purchase-orders/po-1/lines/${productId}`).expect(200);

    expect(removeLine.execute).toHaveBeenCalledWith({ id: 'po-1', productId });
    expect(res.body).toEqual({ data: { id: 'po-1' }, message: 'Line removed' });
  });
});
