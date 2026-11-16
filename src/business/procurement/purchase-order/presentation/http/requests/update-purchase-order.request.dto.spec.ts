import { updatePurchaseOrderSchema } from './update-purchase-order.request.dto';

describe('updatePurchaseOrderSchema', () => {
  it('accepts a partial header update', () => {
    expect(updatePurchaseOrderSchema.safeParse({ externalReference: 'EXT-1' }).success).toBe(true);
  });

  it('rejects an over-long external reference', () => {
    expect(
      updatePurchaseOrderSchema.safeParse({ externalReference: 'x'.repeat(129) }).success,
    ).toBe(false);
  });
});
