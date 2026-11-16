import { CreateProductMobileResponseDto } from './create-product.mobile.response.dto';

describe('CreateProductMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() => CreateProductMobileResponseDto.schema.parse({ id: 'p-1' })).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreateProductMobileResponseDto.schema.parse({})).toThrow();
  });
});
