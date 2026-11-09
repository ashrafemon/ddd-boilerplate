export class PayableOpenItem {
  private constructor(
    public readonly id: string,
    public readonly vendorId: string,
    public readonly vendorBillId: string,
    public amount: number,
    public outstanding: number,
    public currency: string,
    public dueDate: Date,
    public status: string,
    public readonly companyId: string,
    public readonly tenantId: string | null,
  ) {}

  static create(input: {
    vendorId: string;
    vendorBillId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    companyId: string;
    tenantId: string | null;
  }): PayableOpenItem {
    return new PayableOpenItem(
      crypto.randomUUID(),
      input.vendorId,
      input.vendorBillId,
      input.amount,
      input.amount,
      input.currency,
      input.dueDate,
      'OPEN',
      input.companyId,
      input.tenantId,
    );
  }

  pay(amount: number): void {
    this.outstanding -= amount;
    if (this.outstanding <= 0) {
      this.status = 'PAID';
    } else {
      this.status = 'PARTIAL';
    }
  }
}
