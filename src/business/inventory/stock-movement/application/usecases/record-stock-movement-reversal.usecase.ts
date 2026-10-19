import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { StockMovement } from '../../domain/aggregates/stock-movement.aggregate';
import { StockMovementCommandRepository } from '../../domain/repositories/stock-movement-command.repository';
import { MovementType } from '../../domain/types/stock-movement.types';
import { RecordStockMovementUseCase } from './record-stock-movement.usecase';

export interface RecordStockMovementReversalInput {
  /** Source-line key of the COMPENSATING entry: `${reversalGrnId}:${productId}`. */
  grnLineId: string;
  /** Source-line key of the ORIGINAL receipt line: `${originalGrnId}:${productId}`. */
  originalGrnLineId: string;
  productId: string;
  /** Negative mirror of the originally recorded quantity. */
  quantity: number;
  sourceDocumentId: string;
  sourceDocumentType: string;
  companyId: string;
  tenantId: string;
  actorId?: string;
}

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
  constructor(
    private readonly repository: StockMovementCommandRepository,
    private readonly recordMovement: RecordStockMovementUseCase,
  ) {}

  @Transactional()
  async execute(input: RecordStockMovementReversalInput): Promise<StockMovement | null> {
    const original = await this.repository.findByGrnLineAndType(
      input.originalGrnLineId,
      MovementType.GOODS_RECEIPT,
    );
    if (!original) {
      return null;
    }

    return this.recordMovement.execute({
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
  }
}
