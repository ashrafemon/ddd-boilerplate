import { FindPurchasableProductsBySkusUseCase } from './find-purchasable-products-by-skus.usecase';
import { ProductQuery } from '../queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

describe('FindPurchasableProductsBySkusUseCase', () => {
  const query = { findPurchasableBySkus: jest.fn() };
  let usecase: FindPurchasableProductsBySkusUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new FindPurchasableProductsBySkusUseCase(query as unknown as ProductQuery);
  });

  it('returns purchasable products by sku', async () => {
    const result = [{ id: 'p-1' }] as unknown as ProductQueryRecord[];
    query.findPurchasableBySkus.mockResolvedValue(result);
    await expect(usecase.execute(['SKU-1'])).resolves.toBe(result);
    expect(query.findPurchasableBySkus).toHaveBeenCalledWith(['SKU-1']);
  });
});
