import { ConflictException } from '@nestjs/common';
import { CreateProductUseCase } from '../../application/use-cases/create-product.usecase';
import { ProductController } from '../../presentation/http/product.controller';
import { ApiTestApp, createApiTestApp, idOf } from '@test/utils/api-test-app';

describe('POST /products', () => {
  let api: ApiTestApp;
  const create = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: ProductController,
      providers: [{ provide: CreateProductUseCase, useValue: create }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('creates a product', async () => {
    create.execute.mockResolvedValue(idOf('p-1'));

    const res = await api
      .http()
      .post('/products')
      .send({ sku: 'SKU-1', name: 'Mouse', unitPrice: 10 })
      .expect(201);

    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product created' });
  });

  it('defaults the currency to USD when the client omits it', async () => {
    create.execute.mockResolvedValue(idOf('p-1'));

    await api
      .http()
      .post('/products')
      .send({ sku: 'SKU-1', name: 'Mouse', unitPrice: 10 })
      .expect(201);

    expect(create.execute).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'SKU-1', unitPrice: 10, currency: 'USD' }),
    );
  });

  it('rejects a body without sku (400)', async () => {
    await api.http().post('/products').send({ name: 'Mouse' }).expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('rejects a negative unit price (400)', async () => {
    await api
      .http()
      .post('/products')
      .send({ sku: 'SKU-2', name: 'Mouse', unitPrice: -1 })
      .expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('maps a duplicate sku to 409', async () => {
    create.execute.mockRejectedValue(new ConflictException('duplicate sku'));

    await api
      .http()
      .post('/products')
      .send({ sku: 'SKU-1', name: 'Mouse', unitPrice: 10 })
      .expect(409);
  });
});
