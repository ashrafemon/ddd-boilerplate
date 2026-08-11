export interface PurchaseOrderLineReadModel {
  id: string;
  lineNumber: number;
  productId: string;
  description: string;
  quantity: string;
  unitPriceCents: number;
  taxRateBps: number;
  netAmountCents: number;
  taxAmountCents: number;
  totalCents: number;
}

export interface PurchaseOrderReadModel {
  id: string;
  tenantId: string;
  organizationId: string;
  number: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  status: string;
  currency: string;
  totalCents: number;
  notes: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  completedAt: Date | null;
  lines: PurchaseOrderLineReadModel[];
}

/**
 * Read-side repository for purchase orders, optimized for queries.
 */
export abstract class PurchaseOrderReadRepositoryPort {
  public abstract findById(id: string): Promise<PurchaseOrderReadModel | null>;
}
