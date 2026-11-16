import { GetGrnWebResponseDto } from './get-grn.web.response.dto';

describe('GetGrnWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetGrnWebResponseDto.schema.parse({
        id: 'grn-1',
        grnNumber: 'GRN-1',
        purchaseOrderId: 'po-1',
        vendorId: 'v-1',
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 10,
        total: 10,
        lines: [
          { productId: 'p-1', orderedQuantity: 2, receivedQuantity: 1, unitPrice: 5, total: 5 },
        ],
        receivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() =>
      GetGrnWebResponseDto.schema.parse({ id: 'grn-1', lines: [{ productId: 'p-1' }] }),
    ).toThrow();
  });
});
