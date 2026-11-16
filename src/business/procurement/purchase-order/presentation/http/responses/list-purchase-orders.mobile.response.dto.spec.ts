import { ListPurchaseOrdersMobileResponseDto } from './list-purchase-orders.mobile.response.dto';

describe('ListPurchaseOrdersMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListPurchaseOrdersMobileResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListPurchaseOrdersMobileResponseDto.schema.parse({ items: [] })).toThrow();
  });
});
