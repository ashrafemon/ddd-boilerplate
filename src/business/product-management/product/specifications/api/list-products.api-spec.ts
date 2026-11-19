import { ListProductsUseCase } from '../../application/use-cases/list-products.usecase';
import { ProductController } from '../../presentation/http/product.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /products', () => {
  let api: ApiTestApp;
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: ProductController,
      providers: [{ provide: ListProductsUseCase, useValue: list }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists products', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    const res = await api.http().get('/products').expect(200);

    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Products fetched' });
  });

  it('passes the paging query through to the use case', async () => {
    list.execute.mockResolvedValue({ items: [], total: 0 });

    await api.http().get('/products?page=1&pageSize=25').expect(200);

    expect(list.execute).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 25 }));
  });
});
