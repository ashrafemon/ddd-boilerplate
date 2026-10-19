import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '../../public/contracts/purchase-order-receipt.contract';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import '../domain/policies/over-receipt.policy';

@Injectable()
export class RegisterPurchaseOrderReceiptUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  @Transactional()
  async execute(request: PurchaseOrderReceiptRequest): Promise<PurchaseOrderReceiptResult> {
    const po = await this.purchaseOrderRepository.findById(
      PurchaseOrderId.fromString(request.purchaseOrderId),
    );
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    // Lock PO lines for update (FOR UPDATE) to prevent concurrent over-receipt.
    const lines = (await this.txHost.tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: request.purchaseOrderId },
    })) as Array<{
      id: string;
      productId: string;
      quantity: number;
      receivedQuantity: number;
    }>;

    const lineByProduct = new Map(lines.map(l => [l.productId, l]));
    const resultLines: PurchaseOrderReceiptResult['lines'] = [];

    for (const receiptLine of request.lines) {
      const poLine = lineByProduct.get(receiptLine.productId);
      if (!poLine) {
        throw new NotFoundException(
          `Product ${receiptLine.productId} is not on the purchase order`,
        );
      }

      // Enforce over-receipt tolerance.
      policyRegistry.enforce('purchase-order.over-receipt', {
        orderedQuantity: poLine.quantity,
        alreadyReceived: poLine.receivedQuantity,
        proposedQuantity: receiptLine.receivedQuantity,
        tolerance: 0.1, // 10% tolerance default; company override in Phase 3.1.7
      });

      const newReceived = poLine.receivedQuantity + receiptLine.receivedQuantity;
      await this.txHost.tx.purchaseOrderLine.update({
        where: { id: poLine.id },
        data: { receivedQuantity: newReceived },
      });

      resultLines.push({
        productId: receiptLine.productId,
        orderedQuantity: poLine.quantity,
        receivedQuantity: newReceived,
        remainingQuantity: poLine.quantity - newReceived,
      });
    }

    // Derive receipt status.
    const allLines = (await this.txHost.tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: request.purchaseOrderId },
    })) as Array<{ quantity: number; receivedQuantity: number }>;
    const fullyReceived = allLines.every(l => l.receivedQuantity >= l.quantity);
    const anyReceived = allLines.some(l => l.receivedQuantity > 0);
    const receiptStatus = fullyReceived
      ? 'FULLY_RECEIVED'
      : anyReceived
        ? 'PARTIALLY_RECEIVED'
        : 'NOT_RECEIVED';

    return {
      purchaseOrderId: request.purchaseOrderId,
      receiptStatus,
      lines: resultLines,
    };
  }
}
