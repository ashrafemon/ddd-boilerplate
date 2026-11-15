import { FinanceCalculationService } from './finance-calculation.service';
import { JournalEntryStatus } from '../types/finance.enum';
import { VendorBillStatus, PaymentStatus } from '../types/finance.enum';

describe('FinanceCalculationService', () => {
  it('creates a journal entry through the aggregate', () => {
    const entry = FinanceCalculationService.createJournalEntry({
      entryNo: 'JE-1',
      postingDate: new Date(),
      companyId: 'c',
      tenantId: null,
    });
    expect(entry.status).toBe(JournalEntryStatus.DRAFT);
  });

  it('creates a vendor bill', () => {
    const bill = FinanceCalculationService.createVendorBill({
      billNo: 'BILL-1',
      vendorId: 'v1',
      amount: 100,
      currency: 'USD',
      dueDate: new Date(),
      companyId: 'c',
      tenantId: null,
    });
    expect(bill.status).toBe(VendorBillStatus.DRAFT);
  });

  it('creates a payment', () => {
    const payment = FinanceCalculationService.createPayment({
      paymentNo: 'PAY-1',
      amount: 100,
      currency: 'USD',
      companyId: 'c',
      tenantId: null,
    });
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });

  it('creates a payable open item', () => {
    const item = FinanceCalculationService.createPayableOpenItem({
      vendorId: 'v1',
      vendorBillId: 'b1',
      amount: 100,
      currency: 'USD',
      dueDate: new Date(),
      companyId: 'c',
      tenantId: null,
    });
    expect(item.outstanding).toBe(100);
  });

  describe('balance', () => {
    it('returns zero when balanced', () => {
      expect(FinanceCalculationService.balance([100, 50], [150])).toBe(0);
    });

    it('returns a positive difference when debits exceed credits', () => {
      expect(FinanceCalculationService.balance([200], [100])).toBe(100);
    });

    it('returns a negative difference when credits exceed debits', () => {
      expect(FinanceCalculationService.balance([100], [200])).toBe(-100);
    });

    it('returns zero for empty arrays', () => {
      expect(FinanceCalculationService.balance([], [])).toBe(0);
    });
  });
});
