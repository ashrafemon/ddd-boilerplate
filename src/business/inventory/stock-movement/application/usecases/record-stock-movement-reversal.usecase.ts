import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { StockMovement } from '../../domain/aggregates/stock-movement.aggregate';
import { StockMovementCommandRepository } from '../../domain/repositories/stock-movement-command.repository';
import { StockMovementFactory } from '../../domain/factories/stock-movement.factory';
import {
  MovementType,
  RecordStockMovementReversalInput,
} from '../../domain/types/stock-movement.types';

/**
 * Compensating stock movement for `GoodsReceiptReversed` (plan Phase 5.5 /
 * GRN-05): links `reversalOfId` to the original GOODS_RECEIPT movement and
 * reuses the same natural-idempotency write (`grnLineId + movementType`), so
 * redelivered reversals never double-decrement.
 *
 * If the original receipt movement is not recorded YET, the call returns
 * null instead of pushing stock negative on a receipt that never happened.
 * The caller (the reversal consumer) treats that as "not yet" and defers:
 * the reversal event can overtake the receipt event, and dropping the
 * compensation would leave the stock balance permanently wrong.
 */
@Injectable()
export class RecordStockMovementReversalUseCase {
  constructor(private readonly repository: StockMovementCommandRepository) {}

  @Transactional()
  async execute(input: RecordStockMovementReversalInput): Promise<StockMovement | null> {
    const original = await this.repository.findByGrnLineAndType(
      input.originalGrnLineId,
      MovementType.GOODS_RECEIPT,
    );
    if (!original) {
      return null;
    }

    const existing = await this.repository.findByGrnLineAndType(
      input.grnLineId,
      MovementType.GOODS_RECEIPT_REVERSAL,
    );
    if (existing) {
      return existing;
    }

    const movement = StockMovementFactory.create({
      grnLineId: input.grnLineId,
      productId: input.productId,
      quantity: input.quantity,
      movementType: MovementType.GOODS_RECEIPT_REVERSAL,
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentType: input.sourceDocumentType,
      companyId: input.companyId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      reversalOfId: original.id.toString(),
    });
    await this.repository.save(movement);
    return movement;
  }
}
