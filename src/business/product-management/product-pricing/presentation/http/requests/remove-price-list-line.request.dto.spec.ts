import { RemovePriceListLineSchema } from './remove-price-list-line.request.dto';

describe('RemovePriceListLineSchema', () => {
  it('accepts an empty payload', () => {
    expect(RemovePriceListLineSchema.safeParse({}).success).toBe(true);
  });
});
