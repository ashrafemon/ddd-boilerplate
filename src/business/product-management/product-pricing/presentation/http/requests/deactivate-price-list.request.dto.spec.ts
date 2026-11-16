import { DeactivatePriceListSchema } from './deactivate-price-list.request.dto';

describe('DeactivatePriceListSchema', () => {
  it('accepts an empty payload', () => {
    expect(DeactivatePriceListSchema.safeParse({}).success).toBe(true);
  });
});
