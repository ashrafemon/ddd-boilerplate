import { changePriceSchema } from './change-price.request.dto';

describe('changePriceSchema', () => {
  it('defaults the currency', () => {
    expect(changePriceSchema.parse({ unitPrice: 10 }).currency).toBe('USD');
  });

  it('rejects a negative price', () => {
    expect(changePriceSchema.safeParse({ unitPrice: -1 }).success).toBe(false);
  });
});
