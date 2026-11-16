import { GetInvoiceMobileResponseDto } from './get-invoice.mobile.response.dto';

describe('GetInvoiceMobileResponseDto', () => {
  it('accepts a valid payload', () => {
    expect(() =>
      GetInvoiceMobileResponseDto.schema.parse({
        id: 'inv-1',
        invoiceNo: 'INV-1',
        status: 'DRAFT',
        totalAmount: 10,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid payload', () => {
    expect(() => GetInvoiceMobileResponseDto.schema.parse({ id: 'inv-1' })).toThrow();
  });
});
