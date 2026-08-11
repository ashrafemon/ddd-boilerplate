import { PageQuery } from '@shared-kernel/types/pagination';
import { PurchaseOrder } from '../../domain/entities/purchase-order.aggregate';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';

export interface PurchaseOrderRepositoryPort {
  save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null>;
  findAll(query: PageQuery): Promise<{ items: PurchaseOrder[]; total: number }>;
  nextOrderSequence(): Promise<number>;
}

export const PURCHASE_ORDER_REPOSITORY = Symbol('PURCHASE_ORDER_REPOSITORY');
