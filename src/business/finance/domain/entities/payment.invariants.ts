import { PaymentStatus } from '../types/finance.enum';

export class PaymentInvariants {
  static enforcePaymentCreate(paymentNo: string, amount: number, currency: string): void {
    if (!paymentNo?.trim()) {
      throw Object.assign(new Error('Payment number is required'), { statusCode: 422 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Object.assign(new Error('Payment amount must be positive'), { statusCode: 422 });
    }
    if (!currency?.trim()) {
      throw Object.assign(new Error('Currency is required'), { statusCode: 422 });
    }
  }

  static enforcePaymentStatusTransition(status: PaymentStatus, to: PaymentStatus): void {
    if (status === to) return;

    const allowed: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [
        PaymentStatus.COMPLETED,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
      ],
      [PaymentStatus.COMPLETED]: [],
      [PaymentStatus.FAILED]: [],
      [PaymentStatus.CANCELLED]: [],
    };

    if (!allowed[status].includes(to)) {
      throw Object.assign(new Error(`Invalid payment transition: ${status} -> ${to}`), {
        statusCode: 422,
      });
    }
  }
}
