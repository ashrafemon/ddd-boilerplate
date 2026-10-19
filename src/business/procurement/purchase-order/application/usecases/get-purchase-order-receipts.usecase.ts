import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

export interface PurchaseOrderReceiptsResult {
  purchaseOrderId: string;
  receiptStatus: 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
  }[];
}

@Injectable()
export class GetPurchaseOrderReceiptsUseCase {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async execute(purchaseOrderId: string): Promise<PurchaseOrderReceiptsResult> {
    const lines = (await this.txHost.tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId },
    })) as Array<{ productId: string; quantity: number; receivedQuantity: number }>;

    const fullyReceived = lines.every(l => (l.receivedQuantity ?? 0) >= l.quantity);
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
