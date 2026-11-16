import { NotFoundException } from '@nestjs/common';
import { GetProductPriceUseCase } from './get-product-price.usecase';
import { PriceListQuery } from '../queries/price-list.query';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GetProductPriceResult } from '../../domain/types/price-list.types';

describe('GetProductPriceUseCase', () => {
  const query = { findPurchasablePriceForProduct: jest.fn() };
  const requestContext = { require: jest.fn() };
  let usecase: GetProductPriceUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    requestContext.require.mockReturnValue({ companyId: 'company-1', tenantId: 'tenant-1' });
    usecase = new GetProductPriceUseCase(
      query as unknown as PriceListQuery,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('returns the purchasable price scoped to the request context', async () => {
    const result: GetProductPriceResult = {
      productId: 'p-1',
      price: 10,
      currency: 'USD',
      source: 'price-list-line',
    };
    query.findPurchasablePriceForProduct.mockResolvedValue(result);
    await expect(usecase.execute({ productId: 'p-1' })).resolves.toBe(result);
    expect(query.findPurchasablePriceForProduct).toHaveBeenCalledWith(
      'p-1',
      'company-1',
      'tenant-1',
    );
  });

  it('throws NotFound when no active price exists', async () => {
    query.findPurchasablePriceForProduct.mockResolvedValue(null);
    await expect(usecase.execute({ productId: 'p-1' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
