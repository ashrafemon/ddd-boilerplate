import { PageQuery, PageResult } from '@shared-kernel/types/pagination';

/**
 * Read-side repository port for PurchaseOrder. Adapter injects the Prisma read
 * service and returns projections directly — query use cases skip the domain.
 */
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

export interface PurchaseOrderQueryRepositoryPort {
  findById(id: string): Promise<PurchaseOrderQueryRecord | null>;
  findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null>;
  findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>>;
}

export const PURCHASE_ORDER_QUERY_REPOSITORY = Symbol('PURCHASE_ORDER_QUERY_REPOSITORY');
