import { IdResponseDto } from './id.response.dto';

describe('IdResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() => IdResponseDto.schema.parse({ id: 'p-1' })).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => IdResponseDto.schema.parse({})).toThrow();
  });
});
