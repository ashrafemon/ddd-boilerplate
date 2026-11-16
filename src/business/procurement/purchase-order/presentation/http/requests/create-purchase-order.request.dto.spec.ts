import { createPurchaseOrderSchema } from './create-purchase-order.request.dto';

describe('createPurchaseOrderSchema', () => {
  it('accepts a vendor id and defaults currency', () => {
    const parsed = createPurchaseOrderSchema.parse({
      vendorId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(parsed.currency).toBe('USD');
  });

  it('rejects a non-uuid vendor id', () => {
    expect(createPurchaseOrderSchema.safeParse({ vendorId: 'v-1' }).success).toBe(false);
  });
});
