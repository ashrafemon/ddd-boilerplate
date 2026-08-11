export interface CreatePurchaseOrderLineInput {
  productId: string;
  quantity: number;
  unitPriceCents?: number;
  taxRateBps?: number;
  description?: string;
}

export interface CreatePurchaseOrderInput {
  vendorId: string;
  currency?: string;
  notes?: string;
  lines: CreatePurchaseOrderLineInput[];
}

export interface CreatePurchaseOrderOutput {
  purchaseOrderId: string;
  number: string;
}
