import { ListProductsUseCase } from './list-products.usecase';
import { ProductQuery } from '../queries/product.query';
import { PageResult } from '@common/application/types/pagination';
import { ProductQueryRecord } from '../../domain/types/product.types';

describe('ListProductsUseCase', () => {
  const query = { findAll: jest.fn() };
  let usecase: ListProductsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new ListProductsUseCase(query as unknown as ProductQuery);
  });

  it('delegates to the query repository', async () => {
    const result = { items: [] } as unknown as PageResult<ProductQueryRecord>;
    query.findAll.mockResolvedValue(result);
    const page = { page: 1, pageSize: 20 };
    await expect(usecase.execute(page)).resolves.toBe(result);
    expect(query.findAll).toHaveBeenCalledWith(page);
  });
});
