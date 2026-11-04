export enum MovementType {
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  GOODS_RECEIPT_REVERSAL = 'GOODS_RECEIPT_REVERSAL',
}

export interface StockMovementProps {
  id: string;
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: MovementType;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string;
  actorId?: string;
  effectiveDate: Date;
  reversalOfId?: string;
  createdAt: Date;
}

export interface StockMovementQueryRecord {
  id: string;
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: MovementType;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string;
  actorId?: string;
  effectiveDate: Date;
  reversalOfId?: string;
  createdAt: Date;
}

export interface RecordStockMovementInput {
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: MovementType;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string;
  actorId?: string;
  reversalOfId?: string;
}

export interface RecordStockMovementReversalInput {
  grnLineId: string;
  originalGrnLineId: string;
  productId: string;
  quantity: number;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string;
  actorId?: string;
}
