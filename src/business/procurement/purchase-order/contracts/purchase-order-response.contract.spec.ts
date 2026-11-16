import { GetPurchaseOrderResponseDto } from '../presentation/http/responses/get-purchase-order.response.dto';
import { ListPurchaseOrdersResponseDto } from '../presentation/http/responses/list-purchase-orders.response.dto';

describe('Purchase order response contract', () => {
  it('accepts a valid purchase order payload', () => {
    const payload = {
      id: 'po-1',
      orderNumber: 'PO-100',
      vendorId: 'v-1',
      status: 'DRAFT',
      currency: 'USD',
      subtotal: 10,
      total: 10,
      lines: [{ productId: 'p-1', quantity: 1, unitPrice: 10, total: 10 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => GetPurchaseOrderResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a payload with malformed lines', () => {
    expect(() =>
      GetPurchaseOrderResponseDto.schema.parse({
        id: 'po-1',
        orderNumber: 'PO-100',
        vendorId: 'v-1',
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 10,
        total: 10,
        lines: [{ productId: 'p-1' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow();
  });

  it('accepts a valid purchase order list envelope', () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    expect(() => ListPurchaseOrdersResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a purchase order list envelope with a non-numeric page', () => {
    expect(() =>
      ListPurchaseOrdersResponseDto.schema.parse({
        items: [],
        page: '1',
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
