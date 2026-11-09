import { FinanceCalculationService } from '../services/finance-calculation.service';

export class FinanceFactory {
  static createJournalEntry(input: {
    entryNo: string;
    reference?: string | null;
    postingDate: Date;
    companyId: string;
    tenantId: string | null;
  }) {
    return FinanceCalculationService.createJournalEntry(input);
  }

  static createVendorBill(input: {
    billNo: string;
    vendorId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    companyId: string;
    tenantId: string | null;
  }) {
    return FinanceCalculationService.createVendorBill(input);
  }

  static createPayment(input: {
    paymentNo: string;
    amount: number;
    currency: string;
    companyId: string;
    tenantId: string | null;
  }) {
    return FinanceCalculationService.createPayment(input);
  }

  static createPayableOpenItem(input: {
    vendorId: string;
    vendorBillId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    companyId: string;
    tenantId: string | null;
  }) {
    return FinanceCalculationService.createPayableOpenItem(input);
  }
}
