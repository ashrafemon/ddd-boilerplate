import { OrderNumber, VendorIdRef } from '../value-objects/purchase-order.vos';
import { PurchaseOrderLine } from '../entities/purchase-order-line.entity';
import { PurchaseOrderStatus } from './purchase-order.enum';
export { PurchaseOrderStatus } from './purchase-order.enum';

export interface PurchaseOrderProps {
  orderNumber: OrderNumber;
  vendorId: VendorIdRef;
  externalReference?: string;
  status: PurchaseOrderStatus;
  currency: string;
  lines: PurchaseOrderLine[];
  // Commercial header (spec §3.1) — nullable, DRAFT-editable.
  orderDate?: Date | null;
  expectedDeliveryDate?: Date | null;
  // Actor & approval trail (plan §1.2 / §2.3) — nullable, never backfilled (E-4).
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectedBy?: string | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  issuedBy?: string | null;
  cancelledBy?: string | null;
  // Amendment trail (spec §4 AmendPurchaseOrder, PO-06) — nullable.
  amendedBy?: string | null;
  amendedAt?: Date | null;
  amendmentReason?: string | null;
  lastReceiptBy?: string | null;
  lastReceiptAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderInput {
  orderNumber: string;
  vendorId: string;
  currency?: string;
  externalReference?: string;
  orderDate?: Date;
  expectedDeliveryDate?: Date;
  createdBy?: string;
}

/** Draft-header update (plan Phase 2.2) — every field optional, DRAFT only. */
export interface UpdatePurchaseOrderHeaderInput {
  orderDate?: Date;
  expectedDeliveryDate?: Date;
  externalReference?: string;
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
  actorId?: string;
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
  externalReference?: string | null;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  orderDate?: Date | null;
  expectedDeliveryDate?: Date | null;
  lines: {
    productId: string;
    quantity: number;
    receivedQuantity: number;
    descriptionSnapshot?: string | null;
    unitPrice: number;
    total: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Receipt projection of a purchase order — what has been received per line.
 *
 * Derived from the line rows, never stored; the receipt status itself is
 * computed by the read use case from these numbers.
 */
export interface PurchaseOrderReceiptsQueryRecord {
  purchaseOrderId: string;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
  }[];
}

export interface CreatePurchaseOrderRequest {
  vendorId: string;
  currency?: string;
  externalReference?: string;
  orderDate?: Date;
  expectedDeliveryDate?: Date;
  actorId?: string;
}

export interface AddLineRequest {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  actorId?: string;
}

export interface UpdatePurchaseOrderHeaderRequest extends UpdatePurchaseOrderHeaderInput {
  id: string;
  actorId?: string;
}

/** Draft line rewrite (plan Phase 2.2) — `setLine` semantics, replaces quantity/price. */
export interface UpdatePurchaseOrderLineRequest {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  actorId?: string;
}

export interface RemoveLineRequest {
  id: string;
  productId: string;
}

export interface PurchaseOrderTransitionRequest {
  id: string;
  transition: PurchaseOrderTransition;
  reason?: string;
  actorId?: string;
}
