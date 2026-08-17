import { PageQuery } from '@shared-kernel/types/pagination';
import { PurchaseOrder } from '../../domain/entities';
import { PurchaseOrderId } from '../../domain/value-objects';

/**
 * Command-side repository port for PurchaseOrder. Adapter injects the
 * transactional host adapter — writes share the use case transaction.
 */
export abstract class PurchaseOrderCommandRepositoryPort {
  abstract save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  abstract update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder>;
  abstract findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
  abstract findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null>;
  abstract nextOrderSequence(): Promise<number>;
}

export type { PageQuery };
