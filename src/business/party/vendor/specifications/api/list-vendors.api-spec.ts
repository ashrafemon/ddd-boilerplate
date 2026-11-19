import { ListVendorsUseCase } from '../../application/use-cases/list-vendors.usecase';
import { VendorController } from '../../presentation/http/vendor.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /vendors', () => {
  let api: ApiTestApp;
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: VendorController,
      providers: [{ provide: ListVendorsUseCase, useValue: list }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists vendors', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    const res = await api.http().get('/vendors').expect(200);

    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Vendors fetched' });
  });

  it('passes the paging query through to the use case', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    await api.http().get('/vendors?page=2&pageSize=5').expect(200);

    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 5 }));
  });
});
