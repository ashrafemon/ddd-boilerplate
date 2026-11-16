import { GeneratedPurchaseOrderResult } from '../../public/contracts/recurring-purchase-order-generation.contract';

describe('GeneratedPurchaseOrderResult contract', () => {
  it('carries the generated order id and snapshot', () => {
    const result: GeneratedPurchaseOrderResult = {
      purchaseOrderId: 'po-1',
      snapshot: { total: 10 },
    };
    expect(result.purchaseOrderId).toBe('po-1');
    expect(result.snapshot).toEqual({ total: 10 });
  });
});
