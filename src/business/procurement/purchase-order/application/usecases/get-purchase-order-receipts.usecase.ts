import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { PurchaseOrderReceiptService } from '../../domain/services/purchase-order-receipt.service';
import { PurchaseOrderReceiptsResult } from '../../domain/types/purchase-order.types';

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

    return {
      purchaseOrderId: receipts.purchaseOrderId,
      receiptStatus: PurchaseOrderReceiptService.deriveStatus(receipts.lines),
      lines: receipts.lines,
    };
  }
}
