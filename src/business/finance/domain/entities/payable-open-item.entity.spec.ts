import { PayableOpenItem } from './payable-open-item.entity';

const base = {
  vendorId: 'v1',
  vendorBillId: 'b1',
  amount: 1000,
  currency: 'USD',
  dueDate: new Date('2026-02-01'),
  companyId: 'company-1',
  tenantId: 'tenant-1',
};

describe('PayableOpenItem', () => {
  it('creates an OPEN item with outstanding equal to amount', () => {
    const item = PayableOpenItem.create(base);
    expect(item.status).toBe('OPEN');
    expect(item.outstanding).toBe(1000);
    expect(item.id).toBeTruthy();
  });

  it('marks PARTIAL when partially paid', () => {
    const item = PayableOpenItem.create(base);
    item.pay(400);
    expect(item.outstanding).toBe(600);
    expect(item.status).toBe('PARTIAL');
  });

  it('marks PAID when fully paid', () => {
    const item = PayableOpenItem.create(base);
    item.pay(1000);
    expect(item.outstanding).toBe(0);
    expect(item.status).toBe('PAID');
  });

  it('marks PAID when overpaid', () => {
    const item = PayableOpenItem.create(base);
    item.pay(1500);
    expect(item.outstanding).toBe(-500);
    expect(item.status).toBe('PAID');
  });
});
