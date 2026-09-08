import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { PurchaseOrderQueryRecord } from '../../domain/types/purchase-order.types';

export abstract class PurchaseOrderQuery {
  abstract findById(id: string): Promise<PurchaseOrderQueryRecord | null>;
  abstract findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null>;
  abstract findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>>;
}
