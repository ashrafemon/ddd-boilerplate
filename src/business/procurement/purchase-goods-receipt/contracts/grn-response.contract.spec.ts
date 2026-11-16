import { GetGrnWebResponseDto } from '../presentation/http/responses/get-grn.web.response.dto';
import { ListGrnsWebResponseDto } from '../presentation/http/responses/list-grns.web.response.dto';

describe('GRN response contract', () => {
  it('accepts a valid GRN payload', () => {
    const payload = {
      id: 'grn-1',
      grnNumber: 'GRN-100',
      purchaseOrderId: 'po-1',
      vendorId: 'v-1',
      status: 'DRAFT',
      currency: 'USD',
      subtotal: 10,
      total: 10,
      lines: [
        {
          productId: 'p-1',
          orderedQuantity: 1,
          receivedQuantity: 1,
          unitPrice: 10,
          total: 10,
        },
      ],
      receivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => GetGrnWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a payload with a missing status', () => {
    expect(() =>
      GetGrnWebResponseDto.schema.parse({
        id: 'grn-1',
        grnNumber: 'GRN-100',
        purchaseOrderId: 'po-1',
        vendorId: 'v-1',
        currency: 'USD',
        subtotal: 10,
        total: 10,
        lines: [],
        receivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow();
  });

  it('accepts a valid grn list envelope', () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    expect(() => ListGrnsWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a grn list envelope with a non-numeric page', () => {
    expect(() =>
      ListGrnsWebResponseDto.schema.parse({
        items: [],
        page: '1',
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
