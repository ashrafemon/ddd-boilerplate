import { ListGrnsWebResponseDto } from './list-grns.web.response.dto';

describe('ListGrnsWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListGrnsWebResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListGrnsWebResponseDto.schema.parse({ items: [], page: '1' })).toThrow();
  });
});
