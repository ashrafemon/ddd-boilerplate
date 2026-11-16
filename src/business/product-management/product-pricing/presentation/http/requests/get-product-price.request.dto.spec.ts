import { GetProductPriceSchema } from './get-product-price.request.dto';

describe('GetProductPriceSchema', () => {
  it('accepts a product id', () => {
    expect(GetProductPriceSchema.safeParse({ productId: 'p-1' }).success).toBe(true);
  });

  it('rejects an empty product id', () => {
    expect(GetProductPriceSchema.safeParse({ productId: '' }).success).toBe(false);
  });
});
