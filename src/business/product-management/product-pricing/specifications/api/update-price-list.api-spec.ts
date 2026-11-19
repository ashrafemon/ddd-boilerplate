import { NotFoundException } from '@nestjs/common';
import { UpdatePriceListUseCase } from '../../application/use-cases/update-price-list.usecase';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('PATCH /price-lists/:id', () => {
  let api: ApiTestApp;
  const update = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PriceListController,
      providers: [{ provide: UpdatePriceListUseCase, useValue: update }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('updates the price list', async () => {
    update.execute.mockResolvedValue(undefined);

    const res = await api.http().patch('/price-lists/pl-1').send({ name: 'Wholesale' }).expect(200);

    expect(update.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'pl-1' }));
    expect(res.body).toEqual({ id: 'pl-1' });
  });

  it('maps an unknown price list to 404', async () => {
    update.execute.mockRejectedValue(new NotFoundException('price list not found'));

    await api.http().patch('/price-lists/pl-missing').send({ name: 'Wholesale' }).expect(404);
  });
});
