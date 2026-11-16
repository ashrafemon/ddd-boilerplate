import { addLineSchema } from './add-purchase-order-line.request.dto';

describe('addLineSchema', () => {
  it('accepts a line and defaults the currency', () => {
    const parsed = addLineSchema.parse({
      productId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 2,
      unitPrice: 5,
    });
    expect(parsed.currency).toBe('USD');
  });

  it('rejects a fractional quantity', () => {
    expect(
      addLineSchema.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 1.5,
        unitPrice: 5,
      }).success,
    ).toBe(false);
  });
});
