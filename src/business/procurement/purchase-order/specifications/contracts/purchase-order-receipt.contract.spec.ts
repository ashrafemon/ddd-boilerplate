import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '../../public/contracts/purchase-order-receipt.contract';

describe('PurchaseOrderReceipt contracts', () => {
  it('accepts a receipt request with an optional actor', () => {
    const request: PurchaseOrderReceiptRequest = {
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'p-1', receivedQuantity: 2 }],
    };
    expect(request.purchaseOrderId).toBe('po-1');
    expect(request.actorId).toBeUndefined();
  });

  it.each(['NOT_RECEIVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'] as const)(
    'supports the %s receipt status',
    status => {
      const result: PurchaseOrderReceiptResult = {
        purchaseOrderId: 'po-1',
        receiptStatus: status,
        lines: [
          {
            productId: 'p-1',
            orderedQuantity: 2,
            receivedQuantity: 1,
            remainingQuantity: 1,
          },
        ],
      };
      expect(result.receiptStatus).toBe(status);
      expect(result.lines[0].remainingQuantity).toBe(1);
    },
  );
});
