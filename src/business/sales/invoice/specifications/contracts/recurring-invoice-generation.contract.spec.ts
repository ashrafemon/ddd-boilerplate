import { GeneratedInvoiceResult } from '../../public/contracts/recurring-invoice-generation.contract';

describe('GeneratedInvoiceResult contract', () => {
  it('carries the generated invoice id and snapshot', () => {
    const result: GeneratedInvoiceResult = {
      invoiceId: 'inv-1',
      snapshot: { totalAmount: 10 },
    };
    expect(result.invoiceId).toBe('inv-1');
    expect(result.snapshot).toEqual({ totalAmount: 10 });
  });
});
