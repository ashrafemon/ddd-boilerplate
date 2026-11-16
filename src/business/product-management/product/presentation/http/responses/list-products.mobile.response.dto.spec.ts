import { ListProductsMobileResponseDto } from './list-products.mobile.response.dto';

describe('ListProductsMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListProductsMobileResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListProductsMobileResponseDto.schema.parse({ items: [] })).toThrow();
  });
});
