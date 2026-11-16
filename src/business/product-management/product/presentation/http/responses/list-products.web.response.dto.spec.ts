import { ListProductsWebResponseDto } from './list-products.web.response.dto';

describe('ListProductsWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListProductsWebResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListProductsWebResponseDto.schema.parse({ items: [] })).toThrow();
  });
});
