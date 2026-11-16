import { ActivatePriceListSchema } from './activate-price-list.request.dto';

describe('ActivatePriceListSchema', () => {
  it('accepts an empty payload', () => {
    expect(ActivatePriceListSchema.safeParse({}).success).toBe(true);
  });
});
