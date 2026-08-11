export interface PurchaseOrderIdInput {
  purchaseOrderId: string;
}

export interface PurchaseOrderIdOutput {
  purchaseOrderId: string;
  status: string;
}

export interface ApprovePurchaseOrderInput {
  purchaseOrderId: string;
  approvedByUserId?: string;
}

export interface RejectPurchaseOrderInput {
  purchaseOrderId: string;
  reason: string;
}

export interface CancelPurchaseOrderInput {
  purchaseOrderId: string;
  reason: string;
}
