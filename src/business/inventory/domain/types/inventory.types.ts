export interface StockMovementRecordInput {
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  actorId?: string | null;
  effectiveDate?: Date | null;
}

export interface StockMovementReverseInput {
  movementId: string;
  actorId?: string | null;
  reason?: string | null;
}

export interface StockBalanceResult {
  productId: string;
  companyId: string;
  tenantId: string | null;
  quantity: number;
  updatedAt: Date;
}
