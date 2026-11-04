import type { GrnLine } from '../entities/grn-line.entity';
export interface GrnProps {
  grnNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  status: string;
  currency: string;
  lines: GrnLine[];
  receivedAt: Date | null;
  // Compensating reversal link (plan Phase 4.1): set on the REVERSAL document,
  // pointing at the original posted GRN; null for originals (GRN-05).
  reversalOfId?: string | null;
  // Actor trail (plan §1.2) — nullable, never backfilled (E-4).
  createdBy?: string | null;
  receivedBy?: string | null;
  postedBy?: string | null;
  cancelledBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrnInput {
  grnNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  currency: string;
  createdBy?: string;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
  }[];
}

/** Compensation document input (plan Phase 4.1). */
export interface CreateGrnReversalInput {
  grnNumber: string;
  reversalOfId: string;
  purchaseOrderId: string;
  vendorId: string;
  currency: string;
  actorId?: string;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unitPrice: number;
  }[];
}

/** Inspection split per line (plan Phase 3.2 / invariant GRN-01). */
export interface RecordInspectionResultRequest {
  id: string;
  lines: {
    productId: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
  }[];
  actorId?: string;
  idempotencyKey?: string;
}

export interface AddGrnLineInput {
  id: string;
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
}

export interface ReceiveGrnInput {
  id: string;
}

export interface GrnQueryRecord {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unitPrice: number;
    total: number;
    tracking?: TrackingEntry[];
  }[];
  receivedAt: Date | null;
  reversalOfId?: string | null;
  createdBy?: string | null;
  receivedBy?: string | null;
  postedBy?: string | null;
  cancelledBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrnRequest {
  purchaseOrderId: string;
  vendorId?: string;
  currency?: string;
  actorId?: string;
  /** Optional client key — makes the command replay-safe (scope `grn.create`). */
  idempotencyKey?: string;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
  }[];
}

export interface AddGrnLineRequest {
  id: string;
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
}

export interface ReceiveGrnRequest {
  id: string;
  actorId?: string;
}

export enum GrnStatus {
  DRAFT = 'DRAFT',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface GrnState {
  status: GrnStatus;
}

export interface TrackingEntry {
  lotNo?: string;
  serialNo?: string;
  quantity: number;
  manufactureDate?: Date;
  expiryDate?: Date;
}

export interface SetGrnLineTrackingRequest {
  id: string;
  productId: string;
  entries: TrackingEntry[];
}

export { GrnLine } from '../entities/grn-line.entity';
