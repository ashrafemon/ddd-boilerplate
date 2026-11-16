import { GetProductWebResponseDto } from '../presentation/http/responses/get-product.web.response.dto';
import { ListProductsWebResponseDto } from '../presentation/http/responses/list-products.web.response.dto';

describe('Product response contract', () => {
  it('accepts a valid product payload', () => {
    const payload = {
      id: 'p-1',
      sku: 'SKU-1',
      name: 'Mouse',
      description: null,
      status: 'ACTIVE',
      unitPrice: 9.99,
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => GetProductWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a non-numeric unit price', () => {
    expect(() =>
      GetProductWebResponseDto.schema.parse({
        id: 'p-1',
        sku: 'SKU-1',
        name: 'Mouse',
        description: null,
        status: 'ACTIVE',
        unitPrice: '9.99',
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow();
  });

  it('accepts a valid product list envelope', () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    expect(() => ListProductsWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a product list envelope with a non-numeric page', () => {
    expect(() =>
      ListProductsWebResponseDto.schema.parse({
        items: [],
        page: '1',
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
