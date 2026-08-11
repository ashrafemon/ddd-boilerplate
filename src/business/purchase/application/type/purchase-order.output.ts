export interface GetPurchaseOrderInput {
  purchaseOrderId: string;
}

export interface PurchaseOrderLineOutput {
  id: string;
  lineNumber: number;
  productId: string;
  description: string;
  quantity: string;
  unitPriceCents: number;
  taxRateBps: number;
  netAmountCents: number;
  taxAmountCents: number;
  totalCents: number;
}

export interface PurchaseOrderOutput {
  id: string;
  tenantId: string;
  organizationId: string;
  number: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  status: string;
  currency: string;
  totalCents: number;
  notes: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  completedAt: Date | null;
  lines: PurchaseOrderLineOutput[];
}
