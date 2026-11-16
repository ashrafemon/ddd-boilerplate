import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { CreatePriceListUseCase } from '../../application/use-cases/create-price-list.usecase';
import { UpdatePriceListUseCase } from '../../application/use-cases/update-price-list.usecase';
import { AddPriceListLineUseCase } from '../../application/use-cases/add-price-list-line.usecase';
import { RemovePriceListLineUseCase } from '../../application/use-cases/remove-price-list-line.usecase';
import { ActivatePriceListUseCase } from '../../application/use-cases/activate-price-list.usecase';
import { DeactivatePriceListUseCase } from '../../application/use-cases/deactivate-price-list.usecase';
import { ArchivePriceListUseCase } from '../../application/use-cases/archive-price-list.usecase';
import { GetProductPriceUseCase } from '../../application/use-cases/get-product-price.usecase';

describe('Price List API', () => {
  let app: NestFastifyApplication;
  const mocks = {
    create: { execute: jest.fn() },
    update: { execute: jest.fn() },
    addLine: { execute: jest.fn() },
    removeLine: { execute: jest.fn() },
    activate: { execute: jest.fn() },
    deactivate: { execute: jest.fn() },
    archive: { execute: jest.fn() },
    price: { execute: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PriceListController],
      providers: [
        { provide: CreatePriceListUseCase, useValue: mocks.create },
        { provide: UpdatePriceListUseCase, useValue: mocks.update },
        { provide: AddPriceListLineUseCase, useValue: mocks.addLine },
        { provide: RemovePriceListLineUseCase, useValue: mocks.removeLine },
        { provide: ActivatePriceListUseCase, useValue: mocks.activate },
        { provide: DeactivatePriceListUseCase, useValue: mocks.deactivate },
        { provide: ArchivePriceListUseCase, useValue: mocks.archive },
        { provide: GetProductPriceUseCase, useValue: mocks.price },
      ],
    }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('POST /price-lists creates a price list', async () => {
    mocks.create.execute.mockResolvedValue('pl-1');
    const res = await request(app.getHttpServer())
      .post('/price-lists')
      .send({ name: 'Retail' })
      .expect(201);
    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('POST /price-lists/:id/lines adds a line', async () => {
    mocks.addLine.execute.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer())
      .post('/price-lists/pl-1/lines')
      .send({ productId: 'p-1', price: 10 })
      .expect(201);
    expect(mocks.addLine.execute).toHaveBeenCalledWith({
      priceListId: 'pl-1',
      productId: 'p-1',
      price: 10,
    });
    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('GET /price-lists/products/:productId/price resolves price', async () => {
    const price = { price: 10, currency: 'USD', source: 'price-list' };
    mocks.price.execute.mockResolvedValue(price);
    const res = await request(app.getHttpServer())
      .get('/price-lists/products/p-1/price')
      .expect(200);
    expect(res.body).toEqual(price);
  });

  it('DELETE /price-lists/:id/lines/:productId removes a line', async () => {
    mocks.removeLine.execute.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer())
      .delete('/price-lists/pl-1/lines/p-1')
      .expect(200);
    expect(mocks.removeLine.execute).toHaveBeenCalledWith({
      priceListId: 'pl-1',
      productId: 'p-1',
    });
    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('PATCH /price-lists/:id/activate activates a list', async () => {
    mocks.activate.execute.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer())
      .patch('/price-lists/pl-1/activate')
      .send({ reason: 'go live' })
      .expect(200);
    expect(mocks.activate.execute).toHaveBeenCalledWith({ id: 'pl-1', reason: 'go live' });
    expect(res.body).toEqual({ id: 'pl-1' });
  });
});
