import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';

export interface PurchaseOrderReceiptsResult {
  purchaseOrderId: string;
  /** Derived from the receipt projection (plan Phase 3.4) — never stored. */
  receiptStatus: 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
  }[];
}

/**
 * Read model for `GET /purchase-orders/:id/receipts` (plan Phase 3.6): the
 * PO's receipt projection with a derived receipt status.
 *
 * Reads go through the module's QUERY port — the Prisma implementation reads
 * the replica (`PrismaReadPort`) and applies the tenant scope, so a foreign
 * order is NOT FOUND (404, never 403). The use case never touches Prisma.
 */
@Injectable()
export class GetPurchaseOrderReceiptsUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQuery) {}

  async execute(purchaseOrderId: string): Promise<PurchaseOrderReceiptsResult> {
    const receipts = await this.purchaseOrderQueryRepo.findReceipts(purchaseOrderId);
    if (!receipts) {
      throw new NotFoundException('Purchase order not found');
    }

    const lines = receipts.lines;
    const fullyReceived =
      lines.length > 0 && lines.every(l => l.receivedQuantity >= l.orderedQuantity);
    const anyReceived = lines.some(l => l.receivedQuantity > 0);
    const receiptStatus = fullyReceived
      ? 'FULLY_RECEIVED'
      : anyReceived
        ? 'PARTIALLY_RECEIVED'
        : 'NOT_RECEIVED';

    return {
      purchaseOrderId: receipts.purchaseOrderId,
      receiptStatus,
      lines,
    };
  }
}
