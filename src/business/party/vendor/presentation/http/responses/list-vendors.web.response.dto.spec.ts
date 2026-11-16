import { ListVendorsWebResponseDto } from './list-vendors.web.response.dto';

describe('ListVendorsWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListVendorsWebResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListVendorsWebResponseDto.schema.parse({ items: [], page: 1 })).toThrow();
  });
});
