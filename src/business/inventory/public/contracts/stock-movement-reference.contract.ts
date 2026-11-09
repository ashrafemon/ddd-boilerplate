export interface StockMovementReference {
  id: string;
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: string;
  sourceDocumentId: string;
  companyId: string;
  tenantId: string | null;
}

export interface StockBalanceReference {
  productId: string;
  quantity: number;
  companyId: string;
  tenantId: string | null;
}
