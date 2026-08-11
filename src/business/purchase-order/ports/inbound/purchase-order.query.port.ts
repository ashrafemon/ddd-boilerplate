import { PageQuery, PageResult } from '@shared-kernal/types/pagination';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';

export interface PurchaseOrderLineSummary {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrderSummary {
  id: string;
  orderNumber: string;
  vendorId: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  lines: PurchaseOrderLineSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderQueryPort {
  getPurchaseOrder(id: PurchaseOrderId): Promise<PurchaseOrderSummary | null>;
  listPurchaseOrders(query: PageQuery): Promise<PageResult<PurchaseOrderSummary>>;
}

export const PURCHASE_ORDER_QUERY_PORT = Symbol('PURCHASE_ORDER_QUERY_PORT');
