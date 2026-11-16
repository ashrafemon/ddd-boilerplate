import { GetPurchasableProductUseCase } from './get-purchasable-product.usecase';
import { ProductQuery } from '../queries/product.query';
import { ProductQueryRecord } from '../../domain/types/product.types';

describe('GetPurchasableProductUseCase', () => {
  const query = { findPurchasableById: jest.fn() };
  let usecase: GetPurchasableProductUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetPurchasableProductUseCase(query as unknown as ProductQuery);
  });

  it('returns a purchasable product', async () => {
    const result = { id: 'p-1' } as unknown as ProductQueryRecord;
    query.findPurchasableById.mockResolvedValue(result);
    await expect(usecase.execute('p-1')).resolves.toBe(result);
    expect(query.findPurchasableById).toHaveBeenCalledWith('p-1');
  });

  it('returns null when the product is not purchasable', async () => {
    query.findPurchasableById.mockResolvedValue(null);
    await expect(usecase.execute('p-1')).resolves.toBeNull();
  });
});
