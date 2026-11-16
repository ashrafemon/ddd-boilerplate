import { GetGrnMobileResponseDto } from './get-grn.mobile.response.dto';

describe('GetGrnMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetGrnMobileResponseDto.schema.parse({
        id: 'grn-1',
        grnNumber: 'GRN-1',
        status: 'DRAFT',
        total: 10,
        lines: [],
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetGrnMobileResponseDto.schema.parse({ id: 'grn-1' })).toThrow();
  });
});
