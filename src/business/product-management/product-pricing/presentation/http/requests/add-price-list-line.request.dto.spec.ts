import { AddPriceListLineSchema } from './add-price-list-line.request.dto';

describe('AddPriceListLineSchema', () => {
  it('accepts a valid line', () => {
    expect(
      AddPriceListLineSchema.safeParse({ productId: 'p-1', price: 10, minQuantity: 1 }).success,
    ).toBe(true);
  });

  it('rejects a negative price', () => {
    expect(
      AddPriceListLineSchema.safeParse({ productId: 'p-1', price: -1, minQuantity: 1 }).success,
    ).toBe(false);
  });

  it('rejects a zero minimum quantity', () => {
    expect(
      AddPriceListLineSchema.safeParse({ productId: 'p-1', price: 10, minQuantity: 0 }).success,
    ).toBe(false);
  });
});
