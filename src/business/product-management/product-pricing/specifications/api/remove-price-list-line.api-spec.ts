import { RemovePriceListLineUseCase } from '../../application/use-cases/remove-price-list-line.usecase';
import { PriceListController } from '../../presentation/http/price-list.controller';
import { ApiTestApp, createApiTestApp } from '@test/utils/api-test-app';

describe('DELETE /price-lists/:priceListId/lines/:productId', () => {
  let api: ApiTestApp;
  const removeLine = { execute: jest.fn() };

  beforeAll(async () => {
    api = await createApiTestApp({
      controller: PriceListController,
      providers: [{ provide: RemovePriceListLineUseCase, useValue: removeLine }],
    });
  });

  afterAll(async () => api.close());
  beforeEach(() => jest.clearAllMocks());

  it('removes the line', async () => {
    removeLine.execute.mockResolvedValue(undefined);

    const res = await api.http().delete('/price-lists/pl-1/lines/p-1').expect(200);

    expect(removeLine.execute).toHaveBeenCalledWith({ priceListId: 'pl-1', productId: 'p-1' });
    expect(res.body).toEqual({ id: 'pl-1' });
  });
});
