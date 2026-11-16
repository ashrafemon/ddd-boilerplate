import { NotFoundException } from '@nestjs/common';
import { GetPurchaseOrderReceiptsUseCase } from './get-purchase-order-receipts.usecase';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';

describe('GetPurchaseOrderReceiptsUseCase', () => {
  const query = { findReceipts: jest.fn() };
  let usecase: GetPurchaseOrderReceiptsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetPurchaseOrderReceiptsUseCase(query as unknown as PurchaseOrderQuery);
  });

  it('derives NOT_RECEIVED for empty lines', async () => {
    query.findReceipts.mockResolvedValue({ purchaseOrderId: 'po-1', lines: [] });
    await expect(usecase.execute('po-1')).resolves.toEqual({
      purchaseOrderId: 'po-1',
      receiptStatus: 'NOT_RECEIVED',
      lines: [],
    });
  });

  it('derives PARTIALLY_RECEIVED when some quantity is received', async () => {
    query.findReceipts.mockResolvedValue({
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'p-1', orderedQuantity: 10, receivedQuantity: 4, remainingQuantity: 6 }],
    });
    const result = await usecase.execute('po-1');
    expect(result.receiptStatus).toBe('PARTIALLY_RECEIVED');
  });

  it('derives FULLY_RECEIVED when all lines are complete', async () => {
    query.findReceipts.mockResolvedValue({
      purchaseOrderId: 'po-1',
      lines: [
        { productId: 'p-1', orderedQuantity: 10, receivedQuantity: 10, remainingQuantity: 0 },
      ],
    });
    const result = await usecase.execute('po-1');
    expect(result.receiptStatus).toBe('FULLY_RECEIVED');
  });

  it('throws NotFound when the order does not exist', async () => {
    query.findReceipts.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
