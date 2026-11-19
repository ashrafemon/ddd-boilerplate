import { ListPurchaseOrdersUseCase } from '../../application/use-cases/list-purchase-orders.usecase';
import { PurchaseOrderController } from '../../presentation/http/purchase-order.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /purchase-orders', () => {
  let api: ApiTestApp;
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PurchaseOrderController,
      providers: [{ provide: ListPurchaseOrdersUseCase, useValue: list }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists purchase orders', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    const res = await api.http().get('/purchase-orders').expect(200);

    expect(res.body).toEqual({
      data: { items: [], total: 0 },
      message: 'Purchase orders fetched',
    });
  });

  it('normalises the paging query before calling the use case', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    await api.http().get('/purchase-orders?page=2&pageSize=10').expect(200);

    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 10 }));
  });
});
