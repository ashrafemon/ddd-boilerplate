import { HasPurchaseOrderReceiptsUseCase } from './has-purchase-order-receipts.usecase';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';

describe('HasPurchaseOrderReceiptsUseCase', () => {
  const query = { hasReceipts: jest.fn() };
  let usecase: HasPurchaseOrderReceiptsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new HasPurchaseOrderReceiptsUseCase(query as unknown as PurchaseOrderQuery);
  });

  it('returns true when receipts exist', async () => {
    query.hasReceipts.mockResolvedValue(true);
    await expect(usecase.execute('po-1')).resolves.toBe(true);
    expect(query.hasReceipts).toHaveBeenCalledWith('po-1');
  });

  it('returns false when no receipts exist', async () => {
    query.hasReceipts.mockResolvedValue(false);
    await expect(usecase.execute('po-1')).resolves.toBe(false);
  });
});
