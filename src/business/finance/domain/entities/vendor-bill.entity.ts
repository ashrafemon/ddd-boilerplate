import { VendorBillInvariants } from './vendor-bill.invariants';
import { VendorBillStatus } from '../types/finance.enum';

export class VendorBill {
  private constructor(
    public readonly id: string,
    public readonly billNo: string,
    public readonly vendorId: string,
    public amount: number,
    public currency: string,
    public status: string,
    public dueDate: Date,
    public companyId: string,
    public tenantId: string | null,
    public createdAt: Date,
    public updatedAt: Date,
    public version: number,
  ) {}

  static create(input: {
    billNo: string;
    vendorId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    companyId: string;
    tenantId: string | null;
  }): VendorBill {
    VendorBillInvariants.enforceVendorBillCreate(
      input.billNo,
      input.vendorId,
      input.amount,
      input.dueDate,
    );

    const now = new Date();
    return new VendorBill(
      crypto.randomUUID(),
      input.billNo,
      input.vendorId,
      input.amount,
      input.currency,
      'DRAFT',
      input.dueDate,
      input.companyId,
      input.tenantId,
      now,
      now,
      1,
    );
  }

  post(): void {
    VendorBillInvariants.enforceVendorBillStatusTransition(
      this.status as VendorBillStatus,
      VendorBillStatus.POSTED,
    );
    this.status = 'POSTED';
    this.updatedAt = new Date();
  }

  cancel(): void {
    VendorBillInvariants.enforceVendorBillStatusTransition(
      this.status as VendorBillStatus,
      VendorBillStatus.CANCELLED,
    );
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
  }
}
