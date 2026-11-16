import { ListGrnsUseCase } from './list-grns.usecase';
import { GrnQuery } from '../queries/grn.query';
import { PageResult } from '@common/application/types/pagination';
import { GrnQueryRecord } from '../../domain/types/grn.types';

describe('ListGrnsUseCase', () => {
  const query = { findAll: jest.fn() };
  let usecase: ListGrnsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new ListGrnsUseCase(query as unknown as GrnQuery);
  });

  it('delegates to the query repository', async () => {
    const result = { items: [] } as unknown as PageResult<GrnQueryRecord>;
    query.findAll.mockResolvedValue(result);
    const page = { page: 1, pageSize: 20 };
    await expect(usecase.execute(page)).resolves.toBe(result);
    expect(query.findAll).toHaveBeenCalledWith(page);
  });
});
