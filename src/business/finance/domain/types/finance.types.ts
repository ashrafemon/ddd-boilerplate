import { JournalEntryStatus } from './finance.enum';
import { VendorBillStatus } from './finance.enum';
import { PaymentStatus } from './finance.enum';
import { PayableOpenItemStatus } from './finance.enum';

export interface JournalEntryProps {
  id: string;
  entryNo: string;
  reference: string | null;
  postingDate: Date;
  status: JournalEntryStatus;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface AccountingEntryProps {
  id: string;
  journalEntryId: string;
  account: string;
  debit: number;
  credit: number;
  currency: string;
  postingDate: Date;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
}

export interface VendorBillProps {
  id: string;
  billNo: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: VendorBillStatus;
  dueDate: Date;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface PaymentProps {
  id: string;
  paymentNo: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface PayableOpenItemProps {
  id: string;
  vendorId: string;
  vendorBillId: string;
  amount: number;
  outstanding: number;
  currency: string;
  dueDate: Date;
  status: PayableOpenItemStatus;
  companyId: string;
  tenantId: string | null;
}

export interface JournalEntryQueryRecord {
  id: string;
  entryNo: string;
  reference: string | null;
  postingDate: Date;
  status: string;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountingEntryQueryRecord {
  id: string;
  journalEntryId: string;
  account: string;
  debit: number;
  credit: number;
  currency: string;
  postingDate: Date;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
}

export interface VendorBillQueryRecord {
  id: string;
  billNo: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: Date;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentQueryRecord {
  id: string;
  paymentNo: string;
  amount: number;
  currency: string;
  status: string;
  companyId: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayableOpenItemQueryRecord {
  id: string;
  vendorId: string;
  vendorBillId: string;
  amount: number;
  outstanding: number;
  currency: string;
  dueDate: Date;
  status: string;
  companyId: string;
  tenantId: string | null;
}

export interface CreateJournalEntryInput {
  entryNo: string;
  reference?: string | null;
  postingDate: Date;
  entries: Array<{
    account: string;
    debit: number;
    credit: number;
    currency: string;
  }>;
}

export interface PostJournalEntryInput {
  id: string;
}

export interface CreateVendorBillInput {
  billNo: string;
  vendorId: string;
  amount: number;
  currency: string;
  dueDate: Date;
}

export interface SettlePayableInput {
  payableId: string;
  paymentAmount: number;
  currency: string;
  paymentDate: Date;
}

export interface GetPayableOpenItemInput {
  vendorId: string;
  companyId?: string;
  tenantId?: string;
}

export interface GetVendorBillsInput {
  vendorId?: string;
  companyId?: string;
  tenantId?: string;
  status?: string;
}
