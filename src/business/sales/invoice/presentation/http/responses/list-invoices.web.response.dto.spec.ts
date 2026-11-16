import { ListInvoicesWebResponseDto } from './list-invoices.web.response.dto';

describe('ListInvoicesWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListInvoicesWebResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListInvoicesWebResponseDto.schema.parse({ items: [] })).toThrow();
  });
});
