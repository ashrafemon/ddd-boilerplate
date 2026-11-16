import { ListInvoicesMobileResponseDto } from './list-invoices.mobile.response.dto';

describe('ListInvoicesMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListInvoicesMobileResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListInvoicesMobileResponseDto.schema.parse({ items: [] })).toThrow();
  });
});
