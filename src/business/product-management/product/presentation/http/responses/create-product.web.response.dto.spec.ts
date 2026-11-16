import { CreateProductWebResponseDto } from './create-product.web.response.dto';

describe('CreateProductWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      CreateProductWebResponseDto.schema.parse({
        id: 'p-1',
        sku: 'SKU-1',
        name: 'Mouse',
        description: null,
        status: 'ACTIVE',
        unitPrice: 9.99,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreateProductWebResponseDto.schema.parse({ id: 'p-1' })).toThrow();
  });
});
