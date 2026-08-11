import { PurchaseOrder } from '../aggregate/purchase-order/purchase-order.entity';
import { PurchaseOrderId } from '../aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrderStatusValue } from '../value-object/purchase-order-status.vo';

export interface PurchaseOrderLinePersistenceData {
  id: string;
  lineNumber: number;
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRateBps: number;
  netAmountCents: number;
  taxAmountCents: number;
  totalCents: number;
}

/**
 * Explicit persistence model for the PurchaseOrder write repository.
 *
 * The repository never receives the aggregate. The use case assembles this
 * plain data from the input DTO, the tenant/organization context and the
 * domain-computed identity/amounts. The domain is used only to enforce
 * invariants/policies and record domain events; it never generates
 * persistence data.
 *
 * The discriminated union makes creates (all fields required) distinct from
 * partial updates (only the changed fields), so infrastructure never has to
 * guess defaults or cast.
 */
export type PurchaseOrderPersistenceData =
  | PurchaseOrderCreatePersistenceData
  | PurchaseOrderUpdatePersistenceData;

export interface PurchaseOrderCreatePersistenceData {
  operation: 'create';
  id: string;
  tenantId: string;
  organizationId: string;
  number: string;
  vendorId: string;
  status: PurchaseOrderStatusValue;
  currency: string;
  totalCents: number;
  notes?: string | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  approvedByUserId?: string | null;
  rejectedAt?: Date | null;
  rejectedReason?: string | null;
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
  completedAt?: Date | null;
  lines: PurchaseOrderLinePersistenceData[];
}

export interface PurchaseOrderUpdatePersistenceData {
  operation: 'update';
  id: string;
  vendorId?: string;
  status?: PurchaseOrderStatusValue;
  totalCents?: number;
  notes?: string | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  approvedByUserId?: string | null;
  rejectedAt?: Date | null;
  rejectedReason?: string | null;
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
  completedAt?: Date | null;
  lines?: PurchaseOrderLinePersistenceData[];
}

/**
 * Write-side repository for the PurchaseOrder aggregate (domain-owned port).
 */
export abstract class PurchaseOrderWriteRepositoryPort {
  public abstract save(data: PurchaseOrderPersistenceData): Promise<void>;

  public abstract findById(id: PurchaseOrderId): Promise<PurchaseOrder | null>;
}
