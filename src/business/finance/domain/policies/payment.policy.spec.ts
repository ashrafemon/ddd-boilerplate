import { PaymentPolicy } from './payment.policy';
import { PaymentStatus } from '../types/finance.enum';

describe('PaymentPolicy', () => {
  it('allows completing a PENDING payment with a positive amount', () => {
    expect(() =>
      PaymentPolicy.enforcePaymentCompleteAllowed(PaymentStatus.PENDING, 100),
    ).not.toThrow();
  });

  it('rejects a non-positive amount', () => {
    expect(() => PaymentPolicy.enforcePaymentCompleteAllowed(PaymentStatus.PENDING, 0)).toThrow(
      'Payment amount must be positive to complete',
    );
  });

  it('rejects a non-pending payment', () => {
    expect(() => PaymentPolicy.enforcePaymentCompleteAllowed(PaymentStatus.COMPLETED, 100)).toThrow(
      'Cannot complete payment in status COMPLETED',
    );
  });
});
