import { GetPurchaseOrderMobileResponseDto } from './get-purchase-order.mobile.response.dto';

describe('GetPurchaseOrderMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetPurchaseOrderMobileResponseDto.schema.parse({
        id: 'po-1',
        orderNumber: 'PO-1',
        status: 'DRAFT',
        total: 10,
        lines: [],
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetPurchaseOrderMobileResponseDto.schema.parse({ id: 'po-1' })).toThrow();
  });
});
