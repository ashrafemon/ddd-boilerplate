import { PaymentInvariants } from './payment.invariants';
import { PaymentStatus } from '../types/finance.enum';

describe('PaymentInvariants', () => {
  it('accepts a valid payment', () => {
    expect(() => PaymentInvariants.enforcePaymentCreate('PAY-1', 100, 'USD')).not.toThrow();
  });

  it('requires a payment number', () => {
    expect(() => PaymentInvariants.enforcePaymentCreate('', 100, 'USD')).toThrow(
      'Payment number is required',
    );
  });

  it('requires a positive amount', () => {
    expect(() => PaymentInvariants.enforcePaymentCreate('PAY-1', 0, 'USD')).toThrow(
      'Payment amount must be positive',
    );
  });

  it('requires a currency', () => {
    expect(() => PaymentInvariants.enforcePaymentCreate('PAY-1', 100, '')).toThrow(
      'Currency is required',
    );
  });

  it.each([
    [PaymentStatus.PENDING, PaymentStatus.COMPLETED],
    [PaymentStatus.PENDING, PaymentStatus.FAILED],
    [PaymentStatus.PENDING, PaymentStatus.CANCELLED],
  ])('allows %s -> %s', (from, to) => {
    expect(() => PaymentInvariants.enforcePaymentStatusTransition(from, to)).not.toThrow();
  });

  it('rejects transitions from a terminal status', () => {
    expect(() =>
      PaymentInvariants.enforcePaymentStatusTransition(
        PaymentStatus.COMPLETED,
        PaymentStatus.FAILED,
      ),
    ).toThrow('Invalid payment transition');
  });
});
