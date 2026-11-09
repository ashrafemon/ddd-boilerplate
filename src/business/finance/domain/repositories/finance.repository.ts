import { JournalEntry } from '../aggregates/journal-entry.aggregate';
import { VendorBill } from '../entities/vendor-bill.entity';
import { Payment } from '../entities/payment.entity';
import { PayableOpenItem } from '../entities/payable-open-item.entity';

export abstract class JournalEntryRepository {
  abstract findById(id: string): Promise<JournalEntry | null>;
  abstract findByEntryNo(entryNo: string): Promise<JournalEntry | null>;
  abstract save(entry: JournalEntry): Promise<JournalEntry>;
  abstract update(entry: JournalEntry): Promise<JournalEntry>;
}

export abstract class VendorBillRepository {
  abstract findById(id: string): Promise<VendorBill | null>;
  abstract findByBillNo(billNo: string): Promise<VendorBill | null>;
  abstract save(bill: VendorBill): Promise<VendorBill>;
  abstract update(bill: VendorBill): Promise<VendorBill>;
}

export abstract class PaymentRepository {
  abstract findById(id: string): Promise<Payment | null>;
  abstract findByPaymentNo(paymentNo: string): Promise<Payment | null>;
  abstract save(payment: Payment): Promise<Payment>;
  abstract update(payment: Payment): Promise<Payment>;
}

export abstract class PayableOpenItemRepository {
  abstract findByVendor(
    vendorId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<PayableOpenItem[]>;
  abstract save(item: PayableOpenItem): Promise<PayableOpenItem>;
  abstract update(item: PayableOpenItem): Promise<PayableOpenItem>;
}
