import { ConflictException } from '@nestjs/common';
import { AddPriceListLineUseCase } from '../../application/use-cases/add-price-list-line.usecase';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('POST /price-lists/:priceListId/lines', () => {
  let api: ApiTestApp;
  const addLine = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PriceListController,
      providers: [{ provide: AddPriceListLineUseCase, useValue: addLine }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('adds a line', async () => {
    addLine.execute.mockResolvedValue(undefined);

    const res = await api
      .http()
      .post('/price-lists/pl-1/lines')
      .send({ productId: 'p-1', price: 10, minQuantity: 1 })
      .expect(201);

    expect(addLine.execute).toHaveBeenCalledWith(
      expect.objectContaining({ priceListId: 'pl-1', productId: 'p-1', price: 10 }),
    );
    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('rejects a missing minQuantity (400)', async () => {
    await api
      .http()
      .post('/price-lists/pl-1/lines')
      .send({ productId: 'p-1', price: 10 })
      .expect(400);
    expect(addLine.execute).not.toHaveBeenCalled();
  });

  it('rejects a negative price (400)', async () => {
    await api
      .http()
      .post('/price-lists/pl-1/lines')
      .send({ productId: 'p-1', price: -1, minQuantity: 1 })
      .expect(400);
  });

  it('maps a duplicate product line to 409', async () => {
    addLine.execute.mockRejectedValue(new ConflictException('product already priced'));

    await api
      .http()
      .post('/price-lists/pl-1/lines')
      .send({ productId: 'p-1', price: 10, minQuantity: 1 })
      .expect(409);
  });
});
