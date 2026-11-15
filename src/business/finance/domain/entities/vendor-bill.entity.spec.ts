import { VendorBill } from './vendor-bill.entity';
import { VendorBillStatus } from '../types/finance.enum';

const base = {
  billNo: 'BILL-1',
  vendorId: 'v1',
  amount: 500,
  currency: 'USD',
  dueDate: new Date('2026-02-01'),
  companyId: 'company-1',
  tenantId: 'tenant-1',
};

describe('VendorBill', () => {
  it('creates a DRAFT bill', () => {
    const bill = VendorBill.create(base);
    expect(bill.status).toBe(VendorBillStatus.DRAFT);
    expect(bill.amount).toBe(500);
    expect(bill.version).toBe(1);
  });

  it('posts a draft bill', () => {
    const bill = VendorBill.create(base);
    bill.post();
    expect(bill.status).toBe(VendorBillStatus.POSTED);
  });

  it('cancels a draft bill', () => {
    const bill = VendorBill.create(base);
    bill.cancel();
    expect(bill.status).toBe(VendorBillStatus.CANCELLED);
  });

  it('cannot post a cancelled bill', () => {
    const bill = VendorBill.create(base);
    bill.cancel();
    expect(() => bill.post()).toThrow('Invalid vendor bill transition');
  });
});
