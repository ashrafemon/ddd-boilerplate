import { NotFoundException } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from './get-purchase-order.usecase';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

describe('GetPurchaseOrderUseCase', () => {
  const query = { findById: jest.fn() };
  let usecase: GetPurchaseOrderUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetPurchaseOrderUseCase(query as unknown as PurchaseOrderQuery);
  });

  it('returns the purchase order projection', async () => {
    const record = { id: 'po-1' } as unknown as PurchaseOrderQueryRecord;
    query.findById.mockResolvedValue(record);
    await expect(usecase.execute('po-1')).resolves.toBe(record);
    expect(query.findById).toHaveBeenCalledWith('po-1');
  });

  it('throws NotFound when the order does not exist', async () => {
    query.findById.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
