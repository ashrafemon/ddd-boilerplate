import { amendPurchaseOrderSchema } from './amend-purchase-order.request.dto';

describe('amendPurchaseOrderSchema', () => {
  it('accepts a reasoned amendment', () => {
    expect(amendPurchaseOrderSchema.safeParse({ reason: 'price change' }).success).toBe(true);
  });

  it('rejects a too-short reason', () => {
    expect(amendPurchaseOrderSchema.safeParse({ reason: 'no' }).success).toBe(false);
  });

  it('accepts line price overrides', () => {
    expect(
      amendPurchaseOrderSchema.safeParse({
        reason: 'price change',
        lineUnitPrices: { '550e8400-e29b-41d4-a716-446655440000': 12.5 },
      }).success,
    ).toBe(true);
  });
});
