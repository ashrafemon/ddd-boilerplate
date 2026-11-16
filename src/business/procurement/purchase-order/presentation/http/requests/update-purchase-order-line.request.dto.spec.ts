import { updatePurchaseOrderLineSchema } from './update-purchase-order-line.request.dto';

describe('updatePurchaseOrderLineSchema', () => {
  it('accepts a replacement line', () => {
    expect(updatePurchaseOrderLineSchema.safeParse({ quantity: 2, unitPrice: 5 }).success).toBe(
      true,
    );
  });

  it('rejects a zero quantity', () => {
    expect(updatePurchaseOrderLineSchema.safeParse({ quantity: 0, unitPrice: 5 }).success).toBe(
      false,
    );
  });
});
