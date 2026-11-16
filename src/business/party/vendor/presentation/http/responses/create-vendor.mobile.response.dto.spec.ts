import { CreateVendorMobileResponseDto } from './create-vendor.mobile.response.dto';

describe('CreateVendorMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() => CreateVendorMobileResponseDto.schema.parse({ id: 'v-1' })).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreateVendorMobileResponseDto.schema.parse({})).toThrow();
  });
});
