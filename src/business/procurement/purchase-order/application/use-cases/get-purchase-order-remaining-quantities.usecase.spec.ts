import { NotFoundException } from '@nestjs/common';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from './get-purchase-order-remaining-quantities.usecase';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';

describe('GetPurchaseOrderRemainingQuantitiesUseCase', () => {
  const query = { findReceipts: jest.fn() };
  let usecase: GetPurchaseOrderRemainingQuantitiesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    usecase = new GetPurchaseOrderRemainingQuantitiesUseCase(
      query as unknown as PurchaseOrderQuery,
    );
  });

  it('maps receipt lines to remaining quantities', async () => {
    query.findReceipts.mockResolvedValue({
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'p-1', orderedQuantity: 10, receivedQuantity: 4, remainingQuantity: 6 }],
    });
    await expect(usecase.execute('po-1')).resolves.toEqual({
      purchaseOrderId: 'po-1',
      lines: [
        {
          productId: 'p-1',
          orderedQuantity: 10,
          receivedQuantity: 4,
          remainingQuantity: 6,
        },
      ],
    });
  });

  it('throws NotFound when the order does not exist', async () => {
    query.findReceipts.mockResolvedValue(null);
    await expect(usecase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
