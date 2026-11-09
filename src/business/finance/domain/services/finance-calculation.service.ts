import { JournalEntry } from '../aggregates/journal-entry.aggregate';
import { VendorBill } from '../entities/vendor-bill.entity';
import { Payment } from '../entities/payment.entity';
import { PayableOpenItem } from '../entities/payable-open-item.entity';

export class FinanceCalculationService {
  static createJournalEntry(input: {
    entryNo: string;
    reference?: string | null;
    postingDate: Date;
    companyId: string;
    tenantId: string | null;
  }): JournalEntry {
    return JournalEntry.record(input);
  }

  static createVendorBill(input: {
    billNo: string;
    vendorId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    companyId: string;
    tenantId: string | null;
  }): VendorBill {
    return VendorBill.create(input);
  }

  static createPayment(input: {
    paymentNo: string;
    amount: number;
    currency: string;
    companyId: string;
    tenantId: string | null;
  }): Payment {
    return Payment.create(input);
  }

  static createPayableOpenItem(input: {
    vendorId: string;
    vendorBillId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    companyId: string;
    tenantId: string | null;
  }): PayableOpenItem {
    return PayableOpenItem.create(input);
  }

  static balance(debits: number[], credits: number[]): number {
    const totalDebit = debits.reduce((sum, d) => sum + d, 0);
    const totalCredit = credits.reduce((sum, c) => sum + c, 0);
    return totalDebit - totalCredit;
  }
}
