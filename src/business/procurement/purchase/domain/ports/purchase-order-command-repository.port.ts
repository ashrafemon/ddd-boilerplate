import { PageQuery } from '@shared-kernel/types/pagination';
import { PurchaseOrder } from '../../domain/entities/purchase-order.aggregate';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';

export abstract class PurchaseOrderCommandRepositoryPort {
  abstract save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  abstract update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  abstract findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  abstract findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null>;
  abstract nextOrderSequence(): Promise<number>;
}

export type { PageQuery };
