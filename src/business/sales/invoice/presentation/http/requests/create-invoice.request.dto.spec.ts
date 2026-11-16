import { createInvoiceSchema } from './create-invoice.request.dto';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('createInvoiceSchema', () => {
  it('accepts a valid invoice', () => {
    expect(
      createInvoiceSchema.safeParse({
        customerId: UUID,
        lines: [{ description: 'Widget', quantity: 2, unitPrice: 5 }],
      }).success,
    ).toBe(true);
  });

  it('rejects an empty line set', () => {
    expect(createInvoiceSchema.safeParse({ customerId: UUID, lines: [] }).success).toBe(false);
  });

  it('rejects a non-uuid customer id', () => {
    expect(
      createInvoiceSchema.safeParse({
        customerId: 'c-1',
        lines: [{ description: 'Widget', quantity: 1, unitPrice: 5 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a currency that is not three letters', () => {
    expect(
      createInvoiceSchema.safeParse({
        customerId: UUID,
        currency: 'US',
        lines: [{ description: 'Widget', quantity: 1, unitPrice: 5 }],
      }).success,
    ).toBe(false);
  });
});
