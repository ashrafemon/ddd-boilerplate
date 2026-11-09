import { PageQuery, PageResult } from '@common/application/types/pagination';
import { JournalEntryQueryRecord } from '../../domain/types/finance.types';
import { AccountingEntryQueryRecord } from '../../domain/types/finance.types';
import { VendorBillQueryRecord } from '../../domain/types/finance.types';
import { PaymentQueryRecord } from '../../domain/types/finance.types';
import { PayableOpenItemQueryRecord } from '../../domain/types/finance.types';

export abstract class FinanceQuery {
  abstract findJournalEntryById(id: string): Promise<JournalEntryQueryRecord | null>;
  abstract findJournalEntryByEntryNo(entryNo: string): Promise<JournalEntryQueryRecord | null>;
  abstract findAllJournalEntries(query: PageQuery): Promise<PageResult<JournalEntryQueryRecord>>;
  abstract findAccountingEntriesByJournal(
    journalEntryId: string,
  ): Promise<AccountingEntryQueryRecord[]>;
  abstract findVendorBillById(id: string): Promise<VendorBillQueryRecord | null>;
  abstract findVendorBillByBillNo(billNo: string): Promise<VendorBillQueryRecord | null>;
  abstract findAllVendorBills(query: PageQuery): Promise<PageResult<VendorBillQueryRecord>>;
  abstract findPaymentById(id: string): Promise<PaymentQueryRecord | null>;
  abstract findPaymentByPaymentNo(paymentNo: string): Promise<PaymentQueryRecord | null>;
  abstract findPayableOpenItemsByVendor(
    vendorId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<PayableOpenItemQueryRecord[]>;
}
