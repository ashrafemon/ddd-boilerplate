import { ListVendorsUseCase } from './list-vendors.usecase';
import { VendorQuery } from '../queries/vendor.query';
import { PageResult } from '@common/application/types/pagination';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

describe('ListVendorsUseCase', () => {
  const query = { findAll: jest.fn() };
  let usecase: ListVendorsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new ListVendorsUseCase(query as unknown as VendorQuery);
  });

  it('delegates to the query repository', async () => {
    const result = { items: [] } as unknown as PageResult<VendorQueryRecord>;
    query.findAll.mockResolvedValue(result);
    const page = { page: 1, pageSize: 20 };
    await expect(usecase.execute(page)).resolves.toBe(result);
    expect(query.findAll).toHaveBeenCalledWith(page);
  });
});
