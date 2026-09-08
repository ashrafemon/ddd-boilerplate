import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { OrderNumber } from '../value-objects/purchase-order.vos';
import { ProductIdRef, VendorIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { PurchaseOrderStatus } from './purchase-order.enum';
export { PurchaseOrderStatus } from './purchase-order.enum';

export interface PurchaseOrderProps {
  orderNumber: OrderNumber;
  vendorId: VendorIdRef;
  status: PurchaseOrderStatus;
  currency: string;
  lines: PurchaseOrderLine[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderInput {
  orderNumber: string;
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

export type PurchaseOrderTransition = 'submit' | 'approve' | 'reject' | 'cancel' | 'complete';

export interface PurchaseOrderTransitionInput {
  id: string;
  transition: PurchaseOrderTransition;
  reason?: string;
}

export interface PurchaseOrderPolicyState {
  status: PurchaseOrderStatus;
  totalAmount: number;
  autoApproveThreshold: number;
}

export interface PurchaseOrderQueryRecord {
  id: string;
  orderNumber: string;
  vendorId: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  lines: {
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderRequest {
  vendorId: string;
  currency?: string;
}

export interface AddLineRequest {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
}

export interface RemoveLineRequest {
  id: string;
  productId: string;
}

export interface PurchaseOrderTransitionRequest {
  id: string;
  transition: PurchaseOrderTransition;
  reason?: string;
}
