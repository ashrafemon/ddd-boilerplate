import { NotFoundException } from '@nestjs/common';
import { GetProductPriceUseCase } from '../../application/use-cases/get-product-price.usecase';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('GET /price-lists/products/:productId/price', () => {
  let api: ApiTestApp;
  const price = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PriceListController,
      providers: [{ provide: GetProductPriceUseCase, useValue: price }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('resolves the price (unwrapped, no envelope)', async () => {
    const resolved = { price: 10, currency: 'USD', source: 'price-list' };
    price.execute.mockResolvedValue(resolved);

    const res = await api.http().get('/price-lists/products/p-1/price').expect(200);

    expect(res.body).toEqual(resolved);
  });

  it('maps an unpriced product to 404', async () => {
    price.execute.mockRejectedValue(new NotFoundException('no price for product'));

    await api.http().get('/price-lists/products/p-missing/price').expect(404);
  });
});
