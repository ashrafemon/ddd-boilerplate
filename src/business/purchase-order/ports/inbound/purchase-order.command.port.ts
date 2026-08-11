import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';

export interface PurchaseOrderCommandPort {
  createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderId>;
  addLine(input: AddLineInput): Promise<PurchaseOrderId>;
  removeLine(input: RemoveLineInput): Promise<PurchaseOrderId>;
  submit(input: PurchaseOrderIdInput): Promise<PurchaseOrderId>;
  approve(input: PurchaseOrderIdInput): Promise<PurchaseOrderId>;
  reject(input: RejectInput): Promise<PurchaseOrderId>;
  cancel(input: PurchaseOrderIdInput): Promise<PurchaseOrderId>;
  complete(input: PurchaseOrderIdInput): Promise<PurchaseOrderId>;
}

export interface CreatePurchaseOrderInput {
  vendorId: string;
  currency?: string;
}

export interface AddLineInput {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
}

export interface RemoveLineInput {
  id: string;
  productId: string;
}

export interface PurchaseOrderIdInput {
  id: string;
}

export interface RejectInput {
  id: string;
  reason: string;
}

export const PURCHASE_ORDER_COMMAND_PORT = Symbol('PURCHASE_ORDER_COMMAND_PORT');
