import { ChangePriceUseCase } from '../../application/use-cases/change-price.usecase';
import { ProductController } from '../../presentation/http/product.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /products/:id/change-price', () => {
  let api: ApiTestApp;
  const changePrice = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: ProductController,
      providers: [{ provide: ChangePriceUseCase, useValue: changePrice }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('changes the price', async () => {
    changePrice.execute.mockResolvedValue(idOf('p-1'));

    const res = await api
      .http()
      .patch('/products/p-1/change-price')
      .send({ unitPrice: 9.99 })
      .expect(200);

    expect(changePrice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', unitPrice: 9.99 }),
    );
    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product price updated' });
  });

  it('rejects a negative price (400)', async () => {
    await api.http().patch('/products/p-1/change-price').send({ unitPrice: -5 }).expect(400);
    expect(changePrice.execute).not.toHaveBeenCalled();
  });

  it('accepts a zero price (free item)', async () => {
    changePrice.execute.mockResolvedValue(idOf('p-1'));

    await api.http().patch('/products/p-1/change-price').send({ unitPrice: 0 }).expect(200);
  });
});
