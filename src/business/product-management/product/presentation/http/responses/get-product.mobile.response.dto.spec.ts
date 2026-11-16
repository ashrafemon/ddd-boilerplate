import { GetProductMobileResponseDto } from './get-product.mobile.response.dto';

describe('GetProductMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetProductMobileResponseDto.schema.parse({
        id: 'p-1',
        name: 'Mouse',
        status: 'ACTIVE',
        unitPrice: 9.99,
        currency: 'USD',
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetProductMobileResponseDto.schema.parse({ id: 'p-1' })).toThrow();
  });
});
