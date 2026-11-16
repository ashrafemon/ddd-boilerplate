import { createGrnSchema } from './create-grn.request.dto';

const line = {
  productId: '550e8400-e29b-41d4-a716-446655440000',
  orderedQuantity: 2,
  receivedQuantity: 1,
  unitPrice: 5,
};

describe('createGrnSchema', () => {
  it('accepts a GRN and defaults the currency', () => {
    const parsed = createGrnSchema.parse({
      purchaseOrderId: '550e8400-e29b-41d4-a716-446655440000',
      vendorId: '550e8400-e29b-41d4-a716-446655440000',
      lines: [line],
    });
    expect(parsed.currency).toBe('USD');
  });

  it('rejects an empty line set', () => {
    expect(
      createGrnSchema.safeParse({
        purchaseOrderId: '550e8400-e29b-41d4-a716-446655440000',
        vendorId: '550e8400-e29b-41d4-a716-446655440000',
        lines: [],
      }).success,
    ).toBe(false);
  });

  it('rejects an over-long idempotency key', () => {
    expect(
      createGrnSchema.safeParse({
        purchaseOrderId: '550e8400-e29b-41d4-a716-446655440000',
        vendorId: '550e8400-e29b-41d4-a716-446655440000',
        idempotencyKey: 'x'.repeat(201),
        lines: [line],
      }).success,
    ).toBe(false);
  });
});
