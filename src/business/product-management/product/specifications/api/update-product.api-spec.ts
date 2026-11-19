import { NotFoundException } from '@nestjs/common';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.usecase';
import { ProductController } from '../../presentation/http/product.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('PATCH /products/:id', () => {
  let api: ApiTestApp;
  const update = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: ProductController,
      providers: [{ provide: UpdateProductUseCase, useValue: update }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('updates the product', async () => {
    update.execute.mockResolvedValue(idOf('p-1'));

    const res = await api.http().patch('/products/p-1').send({ name: 'Keyboard' }).expect(200);

    expect(update.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1', name: 'Keyboard' }),
    );
    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product updated' });
  });

  it('rejects an empty name (400)', async () => {
    await api.http().patch('/products/p-1').send({ name: '' }).expect(400);
    expect(update.execute).not.toHaveBeenCalled();
  });

  it('maps an unknown product to 404', async () => {
    update.execute.mockRejectedValue(new NotFoundException('Product not found'));

    await api.http().patch('/products/p-missing').send({ name: 'Keyboard' }).expect(404);
  });
});
