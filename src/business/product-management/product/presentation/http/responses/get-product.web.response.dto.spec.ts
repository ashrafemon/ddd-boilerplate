import { GetProductWebResponseDto } from './get-product.web.response.dto';

describe('GetProductWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetProductWebResponseDto.schema.parse({
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
    expect(() => GetProductWebResponseDto.schema.parse({ id: 'p-1' })).toThrow();
  });
});
