import { CreatePurchaseOrderResponseDto } from './create-purchase-order.response.dto';

describe('CreatePurchaseOrderResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      CreatePurchaseOrderResponseDto.schema.parse({
        id: 'po-1',
        orderNumber: 'PO-1',
        vendorId: 'v-1',
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 10,
        total: 10,
        lines: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreatePurchaseOrderResponseDto.schema.parse({ id: 'po-1' })).toThrow();
  });
});
