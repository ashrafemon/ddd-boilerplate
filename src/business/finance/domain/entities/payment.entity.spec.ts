import { Payment } from './payment.entity';
import { PaymentStatus } from '../types/finance.enum';

const base = {
  paymentNo: 'PAY-1',
  amount: 100,
  currency: 'USD',
  companyId: 'company-1',
  tenantId: 'tenant-1',
};

describe('Payment', () => {
  it('creates a PENDING payment', () => {
    const payment = Payment.create(base);
    expect(payment.status).toBe('PENDING');
    expect(payment.amount).toBe(100);
    expect(payment.id).toBeTruthy();
    expect(payment.version).toBe(1);
  });

  it('completes a pending payment', () => {
    const payment = Payment.create(base);
    payment.complete();
    expect(payment.status).toBe(PaymentStatus.COMPLETED);
  });

  it('fails a pending payment', () => {
    const payment = Payment.create(base);
    payment.fail();
    expect(payment.status).toBe(PaymentStatus.FAILED);
  });

  it('is a no-op when completing an already-completed payment', () => {
    const payment = Payment.create(base);
    payment.complete();
    expect(() => payment.complete()).not.toThrow();
    expect(payment.status).toBe(PaymentStatus.COMPLETED);
  });

  it('rejects creation with an invalid amount', () => {
    expect(() => Payment.create({ ...base, amount: 0 })).toThrow('Payment amount must be positive');
  });
});
