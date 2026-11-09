import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { PurchaseOrderRemainingQuantitiesResult } from '../../domain/types/purchase-order.types';

@Injectable()
export class GetPurchaseOrderRemainingQuantitiesUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQuery) {}

  async execute(purchaseOrderId: string): Promise<PurchaseOrderRemainingQuantitiesResult> {
    const receipts = await this.purchaseOrderQueryRepo.findReceipts(purchaseOrderId);
    if (!receipts) {
      throw new NotFoundException('Purchase order not found');
    }
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
