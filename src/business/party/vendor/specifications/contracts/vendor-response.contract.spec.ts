import { GetVendorWebResponseDto } from '../../presentation/http/responses/get-vendor.web.response.dto';
import { ListVendorsWebResponseDto } from '../../presentation/http/responses/list-vendors.web.response.dto';

describe('Vendor response contract', () => {
  it('accepts a valid vendor payload', () => {
    const payload = {
      id: 'v-1',
      code: 'VEN-1',
      name: 'Acme',
      email: null,
      phone: null,
      address: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => GetVendorWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a payload missing required fields', () => {
    expect(() => GetVendorWebResponseDto.schema.parse({ id: 'v-1', name: 'Acme' })).toThrow();
  });

  it('accepts a valid vendor list envelope', () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    expect(() => ListVendorsWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a vendor list envelope with a non-numeric page', () => {
    expect(() =>
      ListVendorsWebResponseDto.schema.parse({
        items: [],
        page: '1',
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
