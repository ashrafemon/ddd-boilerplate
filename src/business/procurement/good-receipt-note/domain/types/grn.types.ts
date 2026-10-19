import { GrnId } from '../value-objects/grn.vos';

export class GrnLine {
  private constructor(
    public readonly productId: string,
    public readonly orderedQuantity: number,
    public readonly receivedQuantity: number,
    public readonly acceptedQuantity: number,
    public readonly rejectedQuantity: number,
    public readonly unitPrice: number,
  ) {}

  static create(
    productId: string,
    orderedQuantity: number,
    receivedQuantity: number,
    unitPrice: number,
    acceptedQuantity?: number,
    rejectedQuantity?: number,
  ): GrnLine {
    const accepted = acceptedQuantity ?? receivedQuantity;
    const rejected = rejectedQuantity ?? 0;
    return new GrnLine(productId, orderedQuantity, receivedQuantity, accepted, rejected, unitPrice);
  }

  get total(): number {
    return this.receivedQuantity * this.unitPrice;
  }

  get acceptedTotal(): number {
    return this.acceptedQuantity * this.unitPrice;
  }

  withReceivedQuantity(receivedQuantity: number): GrnLine {
    return new GrnLine(
      this.productId,
      this.orderedQuantity,
      receivedQuantity,
      this.acceptedQuantity,
      this.rejectedQuantity,
      this.unitPrice,
    );
  }

  withInspection(acceptedQuantity: number, rejectedQuantity: number): GrnLine {
    return new GrnLine(
      this.productId,
      this.orderedQuantity,
      this.receivedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      this.unitPrice,
    );
  }
}

export interface GrnProps {
  id: GrnId;
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
  idempotencyKey?: string;
  actorId?: string;
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
