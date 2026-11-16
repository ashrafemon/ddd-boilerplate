import { ListPurchaseOrdersResponseDto } from './list-purchase-orders.response.dto';

describe('ListPurchaseOrdersResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      ListPurchaseOrdersResponseDto.schema.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => ListPurchaseOrdersResponseDto.schema.parse({ items: [], total: 0 })).toThrow();
  });
});
