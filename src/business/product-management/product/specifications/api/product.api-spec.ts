import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { ProductController } from '../../presentation/http/product.controller';
import { ChangePriceUseCase } from '../../application/use-cases/change-price.usecase';
import { CreateProductUseCase } from '../../application/use-cases/create-product.usecase';
import { GetProductUseCase } from '../../application/use-cases/get-product.usecase';
import { ListProductsUseCase } from '../../application/use-cases/list-products.usecase';
import { ProductStatusUseCase } from '../../application/use-cases/product-status.usecase';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.usecase';

const idOf = (value: string) => ({ toString: () => value });

describe('Product API', () => {
  let app: NestFastifyApplication;
  const mocks = {
    create: { execute: jest.fn() },
    update: { execute: jest.fn() },
    changePrice: { execute: jest.fn() },
    status: { execute: jest.fn() },
    get: { execute: jest.fn() },
    list: { execute: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: CreateProductUseCase, useValue: mocks.create },
        { provide: UpdateProductUseCase, useValue: mocks.update },
        { provide: ChangePriceUseCase, useValue: mocks.changePrice },
        { provide: ProductStatusUseCase, useValue: mocks.status },
        { provide: GetProductUseCase, useValue: mocks.get },
        { provide: ListProductsUseCase, useValue: mocks.list },
      ],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('POST /products creates a product', async () => {
    mocks.create.execute.mockResolvedValue(idOf('p-1'));
    const res = await request(app.getHttpServer())
      .post('/products')
      .send({ sku: 'SKU-1', name: 'Mouse' })
      .expect(201);
    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product created' });
  });

  it('GET /products lists products', async () => {
    mocks.list.execute.mockResolvedValue({ items: [], total: 0 });
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    expect(res.body).toEqual({ data: { items: [], total: 0 }, message: 'Products fetched' });
  });

  it('PATCH /products/:id/change-price changes price', async () => {
    mocks.changePrice.execute.mockResolvedValue(idOf('p-1'));
    const res = await request(app.getHttpServer())
      .patch('/products/p-1/change-price')
      .send({ unitPrice: 9.99 })
      .expect(200);
    expect(mocks.changePrice.execute).toHaveBeenCalledWith({ id: 'p-1', unitPrice: 9.99 });
    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product price updated' });
  });

  it('PATCH /products/:id/discontinue discontinues', async () => {
    mocks.status.execute.mockResolvedValue(idOf('p-1'));
    const res = await request(app.getHttpServer()).patch('/products/p-1/discontinue').expect(200);
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'p-1', action: 'discontinue' });
    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product discontinued' });
  });

  it('GET /products/:id returns a product', async () => {
    mocks.get.execute.mockResolvedValue({ id: 'p-1', name: 'Mouse' });
    const res = await request(app.getHttpServer()).get('/products/p-1').expect(200);
    expect(res.body).toEqual({
      data: { id: 'p-1', name: 'Mouse' },
      message: 'Product fetched',
    });
  });

  it('PATCH /products/:id/activate activates', async () => {
    mocks.status.execute.mockResolvedValue(idOf('p-1'));
    const res = await request(app.getHttpServer()).patch('/products/p-1/activate').expect(200);
    expect(mocks.status.execute).toHaveBeenCalledWith({ id: 'p-1', action: 'activate' });
    expect(res.body).toEqual({ data: { id: 'p-1' }, message: 'Product activated' });
  });
});
