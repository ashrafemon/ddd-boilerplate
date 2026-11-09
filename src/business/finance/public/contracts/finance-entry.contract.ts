export interface FinanceEntryReference {
  id: string;
  entryNo: string;
  status: string;
  companyId: string;
  tenantId: string | null;
}

export interface VendorBillReference {
  id: string;
  billNo: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: string;
}
