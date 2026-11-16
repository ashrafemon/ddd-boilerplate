import { GetPurchaseOrderResponseDto } from './get-purchase-order.response.dto';

describe('GetPurchaseOrderResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetPurchaseOrderResponseDto.schema.parse({
        id: 'po-1',
        orderNumber: 'PO-1',
        vendorId: 'v-1',
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 10,
        total: 10,
        lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5, total: 10 }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() =>
      GetPurchaseOrderResponseDto.schema.parse({ id: 'po-1', lines: [{ productId: 'p-1' }] }),
    ).toThrow();
  });
});
