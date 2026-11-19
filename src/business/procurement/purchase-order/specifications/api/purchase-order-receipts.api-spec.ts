import { NotFoundException } from '@nestjs/common';
import { GetPurchaseOrderReceiptsUseCase } from '../../application/use-cases/get-purchase-order-receipts.usecase';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from '../../application/use-cases/get-purchase-order-remaining-quantities.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /purchase-orders/:id/receipts and /remaining-quantities', () => {
  let api: ApiTestApp;
  const receipts = { execute: jest.fn() };
  const remaining = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [
        { provide: GetPurchaseOrderReceiptsUseCase, useValue: receipts },
        { provide: GetPurchaseOrderRemainingQuantitiesUseCase, useValue: remaining },
      ],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the receipt status', async () => {
    const payload = { status: 'PARTIALLY_RECEIVED', lines: [] };
    receipts.execute.mockResolvedValue(payload);

    const res = await api.http().get('/purchase-orders/po-1/receipts').expect(200);

    expect(receipts.execute).toHaveBeenCalledWith('po-1');
    expect(res.body).toEqual({
      data: payload,
      message: 'Purchase order receipts fetched',
    });
  });

  it('returns the remaining quantities', async () => {
    const payload = [{ productId: 'p-1', remaining: 3 }];
    remaining.execute.mockResolvedValue(payload);

    const res = await api.http().get('/purchase-orders/po-1/remaining-quantities').expect(200);

    expect(remaining.execute).toHaveBeenCalledWith('po-1');
    expect(res.body).toEqual({
      data: payload,
      message: 'Purchase order remaining quantities fetched',
    });
  });

  it('maps a missing order to 404 on both routes', async () => {
    receipts.execute.mockRejectedValue(new NotFoundException('Purchase order not found'));
    remaining.execute.mockRejectedValue(new NotFoundException('Purchase order not found'));

    await api.http().get('/purchase-orders/po-missing/receipts').expect(404);
    await api.http().get('/purchase-orders/po-missing/remaining-quantities').expect(404);
  });
});
