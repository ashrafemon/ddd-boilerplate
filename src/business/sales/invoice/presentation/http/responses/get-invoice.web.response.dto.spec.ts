import { GetInvoiceWebResponseDto } from './get-invoice.web.response.dto';

describe('GetInvoiceWebResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetInvoiceWebResponseDto.schema.parse({
        id: 'inv-1',
        invoiceNo: 'INV-1',
        customerId: 'c-1',
        status: 'DRAFT',
        currency: 'USD',
        totalAmount: 10,
        postedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetInvoiceWebResponseDto.schema.parse({ id: 'inv-1', totalAmount: 10 })).toThrow();
  });
});
