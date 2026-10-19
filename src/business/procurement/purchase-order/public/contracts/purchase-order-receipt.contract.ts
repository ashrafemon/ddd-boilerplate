export interface PurchaseOrderReceiptLine {
  productId: string;
  receivedQuantity: number;
}

export interface PurchaseOrderReceiptRequest {
  purchaseOrderId: string;
  lines: PurchaseOrderReceiptLine[];
  actorId?: string;
}

export interface PurchaseOrderReceiptResult {
  purchaseOrderId: string;
  receiptStatus: 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
  }[];
}
