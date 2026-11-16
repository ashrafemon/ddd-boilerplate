import { CreateGrnWebResponseDto } from './create-grn.web.response.dto';

describe('CreateGrnWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      CreateGrnWebResponseDto.schema.parse({
        id: 'grn-1',
        grnNumber: 'GRN-1',
        purchaseOrderId: 'po-1',
        vendorId: 'v-1',
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 10,
        total: 10,
        lines: [],
        receivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => CreateGrnWebResponseDto.schema.parse({ id: 'grn-1' })).toThrow();
  });
});
