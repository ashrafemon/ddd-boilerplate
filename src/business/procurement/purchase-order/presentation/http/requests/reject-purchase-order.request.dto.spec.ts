import { rejectPurchaseOrderSchema } from './reject-purchase-order.request.dto';

describe('rejectPurchaseOrderSchema', () => {
  it('accepts a reason', () => {
    expect(rejectPurchaseOrderSchema.safeParse({ reason: 'price too high' }).success).toBe(true);
  });

  it('rejects an empty reason', () => {
    expect(rejectPurchaseOrderSchema.safeParse({ reason: '' }).success).toBe(false);
  });
});
