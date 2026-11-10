import { PaymentStatus } from '../types/finance.enum';

export class PaymentPolicy {
  static enforcePaymentCompleteAllowed(status: PaymentStatus, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Payment amount must be positive to complete'), {
        statusCode: 422,
      });
    }
    if (status !== PaymentStatus.PENDING) {
      throw Object.assign(new Error(`Cannot complete payment in status ${status}`), {
        statusCode: 422,
      });
    }
  }
}
