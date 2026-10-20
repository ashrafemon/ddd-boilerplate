import { Injectable } from '@nestjs/common';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';

/**
 * Whether the order already carries received quantities — the signal the
 * cancellation policy uses ("an order with posted receipts cannot be
 * cancelled").
 *
 * Reads through the module's query port: the Prisma implementation applies
 * the tenant scope, so a missing or foreign order is simply "no receipts".
 * It never touches the write connection.
 */
@Injectable()
export class HasPurchaseOrderReceiptsUseCase {
  constructor(private readonly purchaseOrderQueryRepo: PurchaseOrderQuery) {}

  async execute(purchaseOrderId: string): Promise<boolean> {
    return this.purchaseOrderQueryRepo.hasReceipts(purchaseOrderId);
  }
}
