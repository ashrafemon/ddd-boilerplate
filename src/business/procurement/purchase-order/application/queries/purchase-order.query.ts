import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import {
  PurchaseOrderQueryRecord,
  PurchaseOrderReceiptsQueryRecord,
} from '../../domain/types/purchase-order.types';

export abstract class PurchaseOrderQuery {
  abstract findById(id: string): Promise<PurchaseOrderQueryRecord | null>;
  abstract findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null>;
  abstract findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>>;

  /**
   * Receipt projection of one purchase order — `null` when the order does
   * not exist OR belongs to another tenant (404 semantics, never a 403).
   */
  abstract findReceipts(purchaseOrderId: string): Promise<PurchaseOrderReceiptsQueryRecord | null>;

  /**
   * Whether any line of the order already carries a received quantity.
   * `false` for a missing or foreign order.
   */
  abstract hasReceipts(purchaseOrderId: string): Promise<boolean>;
}
