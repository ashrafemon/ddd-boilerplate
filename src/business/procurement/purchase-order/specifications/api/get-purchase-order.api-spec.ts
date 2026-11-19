import { NotFoundException } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '../../application/use-cases/get-purchase-order.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /purchase-orders/:id', () => {
  let api: ApiTestApp;
  const get = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [{ provide: GetPurchaseOrderUseCase, useValue: get }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the purchase order', async () => {
    get.execute.mockResolvedValue({ id: 'po-1', orderNumber: 'PO-1' });

    const res = await api.http().get('/purchase-orders/po-1').expect(200);

    expect(res.body).toEqual({
      data: { id: 'po-1', orderNumber: 'PO-1' },
      message: 'Purchase order fetched',
    });
  });

  it('maps a missing order to 404', async () => {
    get.execute.mockRejectedValue(new NotFoundException('Purchase order not found'));

    await api.http().get('/purchase-orders/po-missing').expect(404);
  });
});
