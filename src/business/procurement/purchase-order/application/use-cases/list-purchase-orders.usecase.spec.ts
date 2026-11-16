import { ListPurchaseOrdersUseCase } from './list-purchase-orders.usecase';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { PageResult } from '@common/application/types/pagination';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

describe('ListPurchaseOrdersUseCase', () => {
  const query = { findAll: jest.fn() };
  let usecase: ListPurchaseOrdersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new ListPurchaseOrdersUseCase(query as unknown as PurchaseOrderQuery);
  });

  it('delegates to the query repository', async () => {
    const result = { items: [] } as unknown as PageResult<PurchaseOrderQueryRecord>;
    query.findAll.mockResolvedValue(result);
    const page = { page: 1, pageSize: 20 };
    await expect(usecase.execute(page)).resolves.toBe(result);
    expect(query.findAll).toHaveBeenCalledWith(page);
  });
});
