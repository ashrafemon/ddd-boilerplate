export interface UpdatePurchaseOrderInput {
  purchaseOrderId: string;
  vendorId?: string;
  currency?: string;
  notes?: string;
  lines?: Array<{
    productId: string;
    quantity: number;
    unitPriceCents?: number;
    taxRateBps?: number;
    description?: string;
  }>;
}

export interface UpdatePurchaseOrderOutput {
  purchaseOrderId: string;
  updatedAt: Date;
}
