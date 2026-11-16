import { createProductSchema } from './create-product.request.dto';

describe('createProductSchema', () => {
  it('accepts a product and defaults currency', () => {
    const parsed = createProductSchema.parse({ sku: 'SKU-1', name: 'Mouse', unitPrice: 9.99 });
    expect(parsed.currency).toBe('USD');
  });

  it('rejects a negative price', () => {
    expect(
      createProductSchema.safeParse({ sku: 'SKU-1', name: 'Mouse', unitPrice: -1 }).success,
    ).toBe(false);
  });
});
