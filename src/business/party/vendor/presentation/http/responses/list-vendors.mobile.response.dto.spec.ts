import { ListVendorsMobileResponseDto } from './list-vendors.mobile.response.dto';

describe('ListVendorsMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListVendorsMobileResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() =>
      ListVendorsMobileResponseDto.schema.parse({
        items: [],
        page: '1',
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
