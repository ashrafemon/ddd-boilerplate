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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrnInput {
  grnNumber: string;
  purchaseOrderId: string;
  vendorId: string;
  currency: string;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
  }[];
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrnRequest {
  purchaseOrderId: string;
  vendorId?: string;
  currency?: string;
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
