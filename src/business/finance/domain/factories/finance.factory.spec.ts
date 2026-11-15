import { FinanceFactory } from './finance.factory';
import { JournalEntryStatus, VendorBillStatus, PaymentStatus } from '../types/finance.enum';

const base = {
  companyId: 'company-1',
  tenantId: 'tenant-1',
  dueDate: new Date('2026-02-01'),
  postingDate: new Date('2026-01-01'),
};

describe('FinanceFactory', () => {
  it('creates a journal entry', () => {
    const entry = FinanceFactory.createJournalEntry({
      entryNo: 'JE-1',
      postingDate: base.postingDate,
      companyId: base.companyId,
      tenantId: base.tenantId,
    });
    expect(entry.status).toBe(JournalEntryStatus.DRAFT);
  });

  it('creates a vendor bill', () => {
    const bill = FinanceFactory.createVendorBill({
      billNo: 'BILL-1',
      vendorId: 'v1',
      amount: 100,
      currency: 'USD',
      dueDate: base.dueDate,
      companyId: base.companyId,
      tenantId: base.tenantId,
    });
    expect(bill.status).toBe(VendorBillStatus.DRAFT);
  });

  it('creates a payment', () => {
    const payment = FinanceFactory.createPayment({
      paymentNo: 'PAY-1',
      amount: 100,
      currency: 'USD',
      companyId: base.companyId,
      tenantId: base.tenantId,
    });
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });

  it('creates a payable open item', () => {
    const item = FinanceFactory.createPayableOpenItem({
      vendorId: 'v1',
      vendorBillId: 'b1',
      amount: 250,
      currency: 'USD',
      dueDate: base.dueDate,
      companyId: base.companyId,
      tenantId: base.tenantId,
    });
    expect(item.amount).toBe(250);
    expect(item.outstanding).toBe(250);
  });
});
