import { GrnId } from '../value-objects/grn.vos';

export class GrnLine {
  private constructor(
    public readonly productId: string,
    public readonly orderedQuantity: number,
    public readonly receivedQuantity: number,
    public readonly unitPrice: number,
  ) {}

  static create(productId: string, orderedQuantity: number, receivedQuantity: number, unitPrice: number): GrnLine {
    return new GrnLine(productId, orderedQuantity, receivedQuantity, unitPrice);
  }

  get total(): number {
    return this.receivedQuantity * this.unitPrice;
  }

  withReceivedQuantity(receivedQuantity: number): GrnLine {
    return new GrnLine(this.productId, this.orderedQuantity, receivedQuantity, this.unitPrice);
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
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrnInput {
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
    unitPrice: number;
    total: number;
  }[];
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrnRequest {
  purchaseOrderId: string;
  vendorId: string;
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

export type GrnStatus = 'DRAFT' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';

export interface GrnState {
  status: GrnStatus;
}