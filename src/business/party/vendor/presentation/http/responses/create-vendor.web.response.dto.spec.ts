import { CreateVendorWebResponseDto } from './create-vendor.web.response.dto';

describe('CreateVendorWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      CreateVendorWebResponseDto.schema.parse({
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
    expect(() => CreateVendorWebResponseDto.schema.parse({ id: 'v-1' })).toThrow();
  });
});
