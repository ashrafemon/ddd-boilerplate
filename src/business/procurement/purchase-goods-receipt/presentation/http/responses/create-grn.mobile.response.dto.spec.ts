import { CreateGrnMobileResponseDto } from './create-grn.mobile.response.dto';

describe('CreateGrnMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() => CreateGrnMobileResponseDto.schema.parse({ id: 'grn-1' })).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreateGrnMobileResponseDto.schema.parse({})).toThrow();
  });
});
