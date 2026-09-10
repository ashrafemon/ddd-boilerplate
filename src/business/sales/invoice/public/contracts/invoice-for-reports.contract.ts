export interface InvoiceReference {
  id: string;
  invoiceNo: string;
  customerId: string;
  status: string;
  currency: string;
  totalAmount: number;
  postedAt: Date | null;
}
