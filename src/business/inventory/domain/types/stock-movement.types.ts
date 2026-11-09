import { StockMovementId } from '../value-objects/stock-movement-id.vo';
import { StockMovementType } from './stock-movement.enum';

export interface StockMovementProps {
  id: StockMovementId;
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: StockMovementType;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string | null;
  actorId: string | null;
  effectiveDate: Date;
  reversalOfId: string | null;
  createdAt: Date;
}

export interface StockBalanceProps {
  id: string;
  productId: string;
  companyId: string;
  tenantId: string | null;
  quantity: number;
  updatedAt: Date;
}

export interface RecordStockMovementInput {
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: StockMovementType;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string | null;
  actorId: string | null;
  effectiveDate: Date;
  reversalOfId: string | null;
}

export interface ReverseStockMovementInput {
  movementId: string;
  actorId?: string | null;
  reason?: string | null;
}

export interface StockBalanceQueryRecord {
  productId: string;
  companyId: string;
  tenantId: string | null;
  quantity: number;
  updatedAt: Date;
}

export interface StockMovementQueryRecord {
  id: string;
  grnLineId: string;
  productId: string;
  quantity: number;
  movementType: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string | null;
  actorId: string | null;
  effectiveDate: Date;
  reversalOfId: string | null;
  createdAt: Date;
}

export interface StockMovementPageResult {
  items: StockMovementQueryRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
