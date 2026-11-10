import { PaymentInvariants } from './payment.invariants';
import { PaymentStatus } from '../types/finance.enum';

export class Payment {
  private constructor(
    public readonly id: string,
    public readonly paymentNo: string,
    public readonly amount: number,
    public readonly currency: string,
    public status: string,
    public readonly companyId: string,
    public readonly tenantId: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public version: number,
  ) {}

  static create(input: {
    paymentNo: string;
    amount: number;
    currency: string;
    companyId: string;
    tenantId: string | null;
  }): Payment {
    PaymentInvariants.enforcePaymentCreate(input.paymentNo, input.amount, input.currency);

    const now = new Date();
    return new Payment(
      crypto.randomUUID(),
      input.paymentNo,
      input.amount,
      input.currency,
      'PENDING',
      input.companyId,
      input.tenantId,
      now,
      now,
      1,
    );
  }

  complete(): void {
    PaymentInvariants.enforcePaymentStatusTransition(
      this.status as PaymentStatus,
      PaymentStatus.COMPLETED,
    );
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  fail(): void {
    PaymentInvariants.enforcePaymentStatusTransition(
      this.status as PaymentStatus,
      PaymentStatus.FAILED,
    );
    this.status = 'FAILED';
    this.updatedAt = new Date();
  }
}
