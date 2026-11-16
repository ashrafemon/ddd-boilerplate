import { GetInvoiceWebResponseDto } from '../presentation/http/responses/get-invoice.web.response.dto';
import { ListInvoicesWebResponseDto } from '../presentation/http/responses/list-invoices.web.response.dto';

describe('Invoice response contract', () => {
  it('accepts a valid invoice payload', () => {
    const payload = {
      id: 'inv-1',
      invoiceNo: 'INV-100',
      customerId: 'c-1',
      status: 'DRAFT',
      currency: 'USD',
      totalAmount: 99.5,
      postedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(() => GetInvoiceWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a payload with a missing invoice number', () => {
    expect(() =>
      GetInvoiceWebResponseDto.schema.parse({
        id: 'inv-1',
        customerId: 'c-1',
        status: 'DRAFT',
        currency: 'USD',
        totalAmount: 99.5,
        postedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow();
  });

  it('accepts a valid invoice list envelope', () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    expect(() => ListInvoicesWebResponseDto.schema.parse(payload)).not.toThrow();
  });

  it('rejects a invoice list envelope with a non-numeric page', () => {
    expect(() =>
      ListInvoicesWebResponseDto.schema.parse({
        items: [],
        page: '1',
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
