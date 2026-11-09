export interface PurchaseOrderReference {
  id: string;
  poNo: string;
  vendorId: string;
  status: string;
  totalAmount: number;
  currency: string;
  companyId: string;
  tenantId: string | null;
}

export interface BillingProgress {
  orderedQuantity: number;
  receivedQuantity: number;
  billedQuantity: number;
  remainingQuantity: number;
}
