import { GetVendorWebResponseDto } from './get-vendor.web.response.dto';

describe('GetVendorWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetVendorWebResponseDto.schema.parse({
        id: 'v-1',
        code: 'V1',
        name: 'Acme',
        email: null,
        phone: null,
        address: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetVendorWebResponseDto.schema.parse({ id: 'v-1', code: 'V1' })).toThrow();
  });
});
