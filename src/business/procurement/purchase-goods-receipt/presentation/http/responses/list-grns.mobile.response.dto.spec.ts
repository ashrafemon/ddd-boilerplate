import { ListGrnsMobileResponseDto } from './list-grns.mobile.response.dto';

describe('ListGrnsMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListGrnsMobileResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListGrnsMobileResponseDto.schema.parse({ items: [] })).toThrow();
  });
});
