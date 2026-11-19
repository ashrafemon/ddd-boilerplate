import { NotFoundException } from '@nestjs/common';
import { GetProductUseCase } from '../../application/use-cases/get-product.usecase';
import { ProductController } from '../../presentation/http/product.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /products/:id', () => {
  let api: ApiTestApp;
  const get = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: ProductController,
      providers: [{ provide: GetProductUseCase, useValue: get }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the product', async () => {
    get.execute.mockResolvedValue({ id: 'p-1', name: 'Mouse' });

    const res = await api.http().get('/products/p-1').expect(200);

    expect(res.body).toEqual({ data: { id: 'p-1', name: 'Mouse' }, message: 'Product fetched' });
  });

  it('maps a missing product to 404', async () => {
    get.execute.mockRejectedValue(new NotFoundException('Product not found'));

    await api.http().get('/products/p-missing').expect(404);
  });
});
