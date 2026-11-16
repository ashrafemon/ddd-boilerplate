import { GetPurchasableProductsUseCase } from './get-purchasable-products.usecase';
import { ProductQuery } from '../queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

describe('GetPurchasableProductsUseCase', () => {
  const query = { findPurchasableByIds: jest.fn() };
  let usecase: GetPurchasableProductsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetPurchasableProductsUseCase(query as unknown as ProductQuery);
  });

  it('returns purchasable products by ids', async () => {
    const result = [{ id: 'p-1' }] as unknown as ProductQueryRecord[];
    query.findPurchasableByIds.mockResolvedValue(result);
    await expect(usecase.execute(['p-1'])).resolves.toBe(result);
    expect(query.findPurchasableByIds).toHaveBeenCalledWith(['p-1']);
  });
});
