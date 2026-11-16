import { InvoiceReference } from '../../public/contracts/invoice-for-reports.contract';

describe('InvoiceReference contract', () => {
  it('exposes reporting fields including postedAt', () => {
    const postedAt = new Date('2026-01-01T00:00:00Z');
    const reference: InvoiceReference = {
      id: 'inv-1',
      invoiceNo: 'INV-1',
      customerId: 'c-1',
      status: 'POSTED',
      currency: 'USD',
      totalAmount: 10,
      postedAt,
    };
    expect(reference).toMatchObject({
      invoiceNo: 'INV-1',
      status: 'POSTED',
      totalAmount: 10,
      postedAt,
    });
  });
});
