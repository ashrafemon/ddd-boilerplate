import { Injectable } from '@nestjs/common';
import { GetPurchaseOrderReceiptsUseCase } from './get-purchase-order-receipts.usecase';

export interface PurchaseOrderRemainingQuantitiesResult {
  purchaseOrderId: string;
  lines: {
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
  }[];
}

/**
 * Read model for `GET /purchase-orders/:id/remaining-quantities` (plan Phase
 * 3.6 / spec §11): what is still open for receiving per line, derived from the
 * same receipt projection as `/receipts` — one source of truth, two shapes
 * (one use case each, per file convention; 404 semantics inherited).
 */
@Injectable()
export class GetPurchaseOrderRemainingQuantitiesUseCase {
  constructor(private readonly receipts: GetPurchaseOrderReceiptsUseCase) {}

  async execute(purchaseOrderId: string): Promise<PurchaseOrderRemainingQuantitiesResult> {
    const receipts = await this.receipts.execute(purchaseOrderId);
    return {
      purchaseOrderId: receipts.purchaseOrderId,
      lines: receipts.lines.map(line => ({
        productId: line.productId,
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: line.receivedQuantity,
        remainingQuantity: line.remainingQuantity,
      })),
    };
  }
}
