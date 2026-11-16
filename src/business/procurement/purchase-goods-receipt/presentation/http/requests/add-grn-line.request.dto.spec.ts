import { addGrnLineSchema } from './add-grn-line.request.dto';

describe('addGrnLineSchema', () => {
  it('accepts a valid line', () => {
    expect(
      addGrnLineSchema.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        orderedQuantity: 2,
        receivedQuantity: 1,
        unitPrice: 5,
      }).success,
    ).toBe(true);
  });

  it('rejects a non-uuid product id', () => {
    expect(
      addGrnLineSchema.safeParse({
        productId: 'p-1',
        orderedQuantity: 2,
        receivedQuantity: 1,
        unitPrice: 5,
      }).success,
    ).toBe(false);
  });

  it('rejects a zero received quantity', () => {
    expect(
      addGrnLineSchema.safeParse({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        orderedQuantity: 2,
        receivedQuantity: 0,
        unitPrice: 5,
      }).success,
    ).toBe(false);
  });
});
