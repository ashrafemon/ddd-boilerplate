import { CreatePriceListSchema } from './create-price-list.request.dto';

describe('CreatePriceListSchema', () => {
  it('accepts a valid price list', () => {
    expect(
      CreatePriceListSchema.safeParse({
        name: 'Retail',
        code: 'PL-1',
        currency: 'USD',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid effective date', () => {
    expect(
      CreatePriceListSchema.safeParse({
        name: 'Retail',
        code: 'PL-1',
        currency: 'USD',
        effectiveFrom: 'not-a-date',
      }).success,
    ).toBe(false);
  });
});
