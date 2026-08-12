import { PageQuery } from '@shared-kernel/types/pagination';
import { PurchaseOrder } from '../../domain/entities/purchase-order.aggregate';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';

/**
 * Command-side repository port for PurchaseOrder. Adapter injects the
 * transactional host adapter — writes share the use case transaction.
 */
export interface PurchaseOrderCommandRepositoryPort {
  save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null>;
  nextOrderSequence(): Promise<number>;
}

export const PURCHASE_ORDER_COMMAND_REPOSITORY = Symbol('PURCHASE_ORDER_COMMAND_REPOSITORY');

export type { PageQuery };
