import { UpdatePriceListSchema } from './update-price-list.request.dto';

describe('UpdatePriceListSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdatePriceListSchema.safeParse({ name: 'New name' }).success).toBe(true);
  });

  it('rejects an invalid effective date', () => {
    expect(UpdatePriceListSchema.safeParse({ effectiveFrom: 'nope' }).success).toBe(false);
  });
});
