import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaReadPort } from '@platform/context/ports/prisma-read.port';

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
 * PO's receipt projection with a derived receipt status. Reads go through
 * `PrismaReadPort` (replica) — never the command transaction, never aggregates.
 */
@Injectable()
export class GetPurchaseOrderReceiptsUseCase {
  constructor(private readonly prismaRead: PrismaReadPort) {}

  async execute(purchaseOrderId: string): Promise<PurchaseOrderReceiptsResult> {
    const purchaseOrder = await this.prismaRead.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { id: true },
    });
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const lines = (await this.prismaRead.purchaseOrderLine.findMany({
      where: { purchaseOrderId },
      orderBy: { productId: 'asc' },
    })) as Array<{ productId: string; quantity: number; receivedQuantity: number }>;

    const fullyReceived =
      lines.length > 0 && lines.every(l => (l.receivedQuantity ?? 0) >= l.quantity);
    const anyReceived = lines.some(l => (l.receivedQuantity ?? 0) > 0);
    const receiptStatus = fullyReceived
      ? 'FULLY_RECEIVED'
      : anyReceived
        ? 'PARTIALLY_RECEIVED'
        : 'NOT_RECEIVED';

    return {
      purchaseOrderId,
      receiptStatus,
      lines: lines.map(l => ({
        productId: l.productId,
        orderedQuantity: l.quantity,
        receivedQuantity: l.receivedQuantity ?? 0,
        remainingQuantity: l.quantity - (l.receivedQuantity ?? 0),
      })),
    };
  }
}
