import { GetVendorMobileResponseDto } from './get-vendor.mobile.response.dto';

describe('GetVendorMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetVendorMobileResponseDto.schema.parse({ id: 'v-1', name: 'Acme', status: 'ACTIVE' }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetVendorMobileResponseDto.schema.parse({ id: 'v-1' })).toThrow();
  });
});
